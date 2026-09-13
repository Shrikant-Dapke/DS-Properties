import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config/environment.js';
import { LOCKOUT, AUDIT_ACTIONS } from '../config/constants.js';
import {
  findUserByUsername,
  findUserById,
  recordLoginFailure,
  lockAccount,
  clearLoginFailures,
  touchLastLogin,
  updatePasswordHash,
} from '../models/userModel.js';
import {
  hashToken,
  storeRefreshToken,
  findRefreshTokenByHash,
  findRefreshTokenByHashForUpdate,
  revokeRefreshToken,
  revokeTokenFamily,
  revokeUserRefreshTokens,
  linkRefreshTokenChain,
} from '../models/refreshTokenModel.js';
import { withTransaction } from '../config/database.js';
import { UnauthorizedError, AccountLockedError } from '../utils/errors.js';
import { logAudit } from './auditService.js';

const BCRYPT_ROUNDS = 12;

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpires },
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function parseExpiry(expiry, fallbackSeconds) {
  if (expiry === undefined || expiry === null || expiry === '') return fallbackSeconds;
  if (typeof expiry === 'number' && Number.isFinite(expiry)) return expiry;
  const str = String(expiry).trim();
  if (/^\d+$/.test(str)) return Number(str);
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/i.exec(str);
  if (!match) {
    const seconds = Number.parseInt(str, 10);
    return Number.isNaN(seconds) ? fallbackSeconds : seconds;
  }
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'ms':
      return value / 1000;
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    case 'w':
      return value * 604800;
    default:
      return fallbackSeconds;
  }
}

export function getRefreshTokenTtlMs() {
  const seconds = parseExpiry(config.jwt.refreshExpires, 7 * 24 * 3600);
  return seconds * 1000;
}

async function issueTokens(user, ctx) {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + getRefreshTokenTtlMs());
  await storeRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return { accessToken, refreshToken, expiresAt };
}

function publicUser(user) {
  return {
    id: user.id,
    publicId: user.public_id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  };
}

export async function login({ username, password }, ctx) {
  const user = await findUserByUsername(username);

  if (user && user.locked_until && user.locked_until > new Date()) {
    const retryAfter = Math.ceil((new Date(user.locked_until) - Date.now()) / 1000);
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      domain: 'auth',
      newValues: { reason: 'locked' },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw new AccountLockedError('Account is temporarily locked due to too many failed attempts', {
      retryAfter,
    });
  }

  if (user && user.locked_until && user.locked_until <= new Date()) {
    await clearLoginFailures(user.id);
  }

  if (!user || !user.is_active || user.deleted_at) {
    await logAudit({
      userId: user?.id ?? null,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      domain: 'auth',
      newValues: { reason: 'invalid_credentials' },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw new UnauthorizedError('Invalid username or password');
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    const updated = await recordLoginFailure(user.id);
    if (updated.failed_login_attempts >= LOCKOUT.MAX_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT.DURATION_MS);
      await lockAccount(user.id, lockedUntil);
      await logAudit({
        userId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        domain: 'auth',
        newValues: { reason: 'account_locked' },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new AccountLockedError('Account locked due to repeated failed attempts');
    }
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      domain: 'auth',
      newValues: { failed_attempts: updated.failed_login_attempts },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw new UnauthorizedError('Invalid username or password');
  }

  await clearLoginFailures(user.id);
  await touchLastLogin(user.id);

  const tokens = await issueTokens(user, ctx);
  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.LOGIN,
    domain: 'auth',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { user: publicUser(user), ...tokens };
}

export async function refresh({ refreshToken }, ctx) {
  const tokenHash = hashToken(refreshToken);
  // Reuse revocation must COMMIT, but withTransaction rolls back on throw.
  // So the reuse branch revokes + commits (returns normally) and we throw
  // outside the transaction; read-only failures throw inside (empty rollback).
  let reuseDetected = false;
  const result = await withTransaction(async () => {
    // SELECT FOR UPDATE serializes concurrent refreshes of the same token:
    // the loser blocks until the winner commits, then sees revoked_at set
    // and falls into reuse detection (family revoked, 401).
    const stored = await findRefreshTokenByHashForUpdate(tokenHash);

    if (!stored || !stored.user_is_active) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (stored.revoked_at || stored.expires_at <= new Date()) {
      // Reuse or expiry: revoke the complete family including the trigger.
      await revokeTokenFamily(stored.family_id);
      reuseDetected = true;
      return null;
    }

    const user = await findUserById(stored.user_id);
    if (!user || !user.is_active || user.deleted_at) {
      throw new UnauthorizedError('User is not active');
    }

    // Rotate: revoke this token and issue a new one in the same family.
    await revokeRefreshToken(stored.id);
    const accessToken = signAccessToken(user);
    const refreshTokenNew = generateRefreshToken();
    const expiresAt = new Date(Date.now() + getRefreshTokenTtlMs());
    const created = await storeRefreshToken({
      userId: user.id,
      tokenHash: hashToken(refreshTokenNew),
      expiresAt,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      familyId: stored.family_id,
    });
    // Chain direction: old.replaced_by_id = new.
    await linkRefreshTokenChain(stored.id, created.id);

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.REFRESH,
      domain: 'auth',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { user: publicUser(user), accessToken, refreshToken: refreshTokenNew, expiresAt };
  });
  if (reuseDetected) {
    throw new UnauthorizedError('Invalid refresh token');
  }
  return result;
}

export async function logout({ refreshToken }, ctx) {
  if (!refreshToken) {
    throw new UnauthorizedError('Missing refresh token');
  }
  const stored = await findRefreshTokenByHash(hashToken(refreshToken));
  if (stored) {
    await revokeRefreshToken(stored.id);
    await logAudit({
      userId: stored.user_id,
      action: AUDIT_ACTIONS.LOGOUT,
      domain: 'auth',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  return { success: true };
}

export async function changePassword({ currentPassword, newPassword }, ctx) {
  const user = await findUserById(ctx.userId);
  if (!user) throw new UnauthorizedError('User not found');

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) throw new UnauthorizedError('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePasswordHash(user.id, passwordHash);
  await revokeUserRefreshTokens(user.id);

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.PASSWORD_CHANGE,
    domain: 'auth',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { success: true };
}

export async function verifyAdminPassword(userId, password) {
  const user = await findUserById(userId);
  if (!user || user.role !== 'admin') throw new UnauthorizedError('Admin verification failed');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new UnauthorizedError('Admin password verification failed');
  return true;
}

export { BCRYPT_ROUNDS, publicUser };