import bcrypt from 'bcrypt';
import {
  findUserByPublicId,
  createUser,
  updateUser,
  listUsers,
  updatePasswordHash,
  softDeleteUser,
} from '../models/userModel.js';
import { revokeUserRefreshTokens } from '../models/refreshTokenModel.js';
import { BCRYPT_ROUNDS } from './authService.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { logAudit } from './auditService.js';

function serialize(user) {
  return {
    publicId: user.public_id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.is_active,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  };
}

export async function listAllUsers({ search, role, page, limit, offset }) {
  const { total, rows } = await listUsers({ search, role, page, limit, offset });
  return { total, rows: rows.map(serialize) };
}

export async function createNewUser(data, ctx) {
  const existing = await findUserByPublicId(data.publicId);
  void existing;
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await createUser({
    username: data.username,
    passwordHash,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    role: data.role,
  }).catch((err) => {
    if (err.code === '23505') {
      throw new ConflictError('Username is already taken', 'USERNAME_TAKEN');
    }
    throw err;
  });

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.USER_CREATE,
    domain: 'users',
    recordId: user.public_id,
    newValues: { username: user.username, role: user.role },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(user);
}

export async function updateExistingUser(publicId, data, ctx) {
  const existing = await findUserByPublicId(publicId);
  if (!existing) throw new NotFoundError('User not found');

  const fields = {};
  if (data.fullName !== undefined) fields.full_name = data.fullName;
  if (data.email !== undefined) fields.email = data.email ?? null;
  if (data.phone !== undefined) fields.phone = data.phone ?? null;
  if (data.role !== undefined) fields.role = data.role;

  const user = await updateUser(existing.id, fields).catch((err) => {
    if (err.code === '23505') throw new ConflictError('Username is already taken', 'USERNAME_TAKEN');
    throw err;
  });

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.USER_UPDATE,
    domain: 'users',
    recordId: user.public_id,
    oldValues: { role: existing.role, fullName: existing.full_name },
    newValues: fields,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(user);
}

export async function setUserActive(publicId, isActive, ctx) {
  const existing = await findUserByPublicId(publicId);
  if (!existing) throw new NotFoundError('User not found');
  if (existing.id === ctx.userId && !isActive) {
    throw new ValidationError('You cannot deactivate your own account');
  }

  const user = await updateUser(existing.id, { is_active: isActive });
  if (!isActive) {
    await revokeUserRefreshTokens(existing.id);
  }

  await logAudit({
    userId: ctx.userId,
    action: isActive ? AUDIT_ACTIONS.USER_ACTIVATE : AUDIT_ACTIONS.USER_DEACTIVATE,
    domain: 'users',
    recordId: user.public_id,
    newValues: { isActive },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(user);
}

export async function resetUserPassword(publicId, newPassword, ctx) {
  const existing = await findUserByPublicId(publicId);
  if (!existing) throw new NotFoundError('User not found');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePasswordHash(existing.id, passwordHash);
  await revokeUserRefreshTokens(existing.id);

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.PASSWORD_RESET,
    domain: 'users',
    recordId: existing.public_id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { success: true };
}

export async function deleteUser(publicId, ctx) {
  const existing = await findUserByPublicId(publicId);
  if (!existing) throw new NotFoundError('User not found');
  if (existing.id === ctx.userId) {
    throw new ValidationError('You cannot delete your own account');
  }

  const user = await softDeleteUser(existing.id);
  await revokeUserRefreshTokens(existing.id);

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.DELETE,
    domain: 'users',
    recordId: user.public_id,
    newValues: { username: user.username },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { success: true };
}