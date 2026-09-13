import bcrypt from 'bcrypt';
import {
  findUserByPublicId,
  createUser,
  updateUser,
  listUsers,
  updatePasswordHash,
  softDeleteUser,
} from '../models/userModel.js';
import { findPartnerByPublicId, findPartnersByIds } from '../models/partnerModel.js';
import { revokeUserRefreshTokens } from '../models/refreshTokenModel.js';
import { BCRYPT_ROUNDS } from './authService.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { logAudit } from './auditService.js';

function serialize(user, partnerRefs) {
  return {
    publicId: user.public_id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    partnerId: user.partner_id ?? null,
    partner: (user.partner_id != null && partnerRefs?.get(user.partner_id)) || null,
    isActive: user.is_active,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  };
}

async function partnerRefsFor(users) {
  const ids = [...new Set(users.map((u) => u.partner_id).filter((id) => id !== null && id !== undefined))];
  if (ids.length === 0) return new Map();
  const rows = await findPartnersByIds(ids);
  return new Map(rows.map((p) => [p.id, { publicId: p.public_id, name: p.name }]));
}

// Business-partner identity rules (enforced for every admin-managed write):
// - role 'partner' REQUIRES a link to an existing active partner record.
// - any other role FORBIDS a link (stale links are cleared on role change).
async function resolvePartnerLink({ role, partnerPublicId, existing }) {
  const provided = partnerPublicId !== undefined && partnerPublicId !== null && partnerPublicId !== '';
  if (role === 'partner') {
    if (!provided) {
      // Keep the current link on updates that don't touch identity; creation
      // without a link is rejected.
      if (existing && existing.partner_id != null) return existing.partner_id;
      throw new ValidationError('Partner users must be linked to a partner record');
    }
    const record = await findPartnerByPublicId(partnerPublicId);
    if (!record || !record.is_active) {
      throw new ValidationError('Partner not found or inactive');
    }
    return record.id;
  }
  if (provided) {
    throw new ValidationError('Only partner users can be linked to a partner record');
  }
  // Leaving the partner role drops the identity link so it cannot linger and
  // block the partner record from being linked to its real operator later.
  if (existing && existing.partner_id != null) return null;
  return undefined;
}

export async function listAllUsers({ search, role, page, limit, offset }) {
  const { total, rows } = await listUsers({ search, role, page, limit, offset });
  const refs = await partnerRefsFor(rows);
  return { total, rows: rows.map((u) => serialize(u, refs)) };
}

export async function createNewUser(data, ctx) {
  // Developer accounts are owner-provisioned only (seed/CLI) and can never be
  // created through the application API — by anyone, including admins.
  if (data.role === 'developer') {
    throw new ValidationError('Developer accounts can only be provisioned by the system owner');
  }
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const partnerId = await resolvePartnerLink({ role: data.role, partnerPublicId: data.partnerPublicId, existing: null });
  const user = await createUser({
    username: data.username,
    passwordHash,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    role: data.role,
    partnerId,
  }).catch((err) => {
    if (err.code === '23505') {
      if (err.constraint === 'uq_users_partner') {
        throw new ConflictError('Partner is already linked to another user', 'PARTNER_LINK_TAKEN');
      }
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

  const refs = await partnerRefsFor([user]);
  return serialize(user, refs);
}

export async function updateExistingUser(publicId, data, ctx) {
  const existing = await findUserByPublicId(publicId);
  if (!existing) throw new NotFoundError('User not found');
  // Developer accounts cannot be modified through the API at all: no
  // promotion TO developer, no edits/deactivation of a developer, no role
  // changes on one. Owner CLI/seed only.
  if (data.role === 'developer' || existing.role === 'developer') {
    throw new ValidationError('Developer accounts can only be managed by the system owner');
  }

  const fields = {};
  if (data.fullName !== undefined) fields.full_name = data.fullName;
  if (data.email !== undefined) fields.email = data.email ?? null;
  if (data.phone !== undefined) fields.phone = data.phone ?? null;
  if (data.role !== undefined) fields.role = data.role;

  const newRole = data.role ?? existing.role;
  const partnerId = await resolvePartnerLink({ role: newRole, partnerPublicId: data.partnerPublicId, existing });
  if (partnerId !== undefined) fields.partner_id = partnerId;

  if (Object.keys(fields).length === 0) {
    await logAudit({
      userId: ctx.userId,
      action: AUDIT_ACTIONS.USER_UPDATE,
      domain: 'users',
      recordId: existing.public_id,
      oldValues: { role: existing.role, fullName: existing.full_name },
      newValues: {},
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    const refs = await partnerRefsFor([existing]);
    return serialize(existing, refs);
  }

  const user = await updateUser(existing.id, fields).catch((err) => {
    if (err.code === '23505' && err.constraint !== 'uq_users_partner') {
      throw new ConflictError('Username is already taken', 'USERNAME_TAKEN');
    }
    if (err.code === '23505') {
      throw new ConflictError('Partner is already linked to another user', 'PARTNER_LINK_TAKEN');
    }
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

  const refs = await partnerRefsFor([user]);
  return serialize(user, refs);
}

export async function setUserActive(publicId, isActive, ctx, allowSelf = false) {
  const existing = await findUserByPublicId(publicId);
  if (!existing) throw new NotFoundError('User not found');
  if (existing.role === 'developer') {
    throw new ValidationError('Developer accounts can only be managed by the system owner');
  }
  // Retired roles stay retired: reactivation is only meaningful for current
  // production roles. Owners re-role legacy accounts through provisioning.
  if (isActive && !['admin', 'partner', 'developer'].includes(existing.role)) {
    throw new ValidationError(`Accounts with retired role '${existing.role}' cannot be reactivated via the API`);
  }
  if (!allowSelf && existing.id === ctx.userId && !isActive) {
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

  const refs = await partnerRefsFor([user]);
  return serialize(user, refs);
}

export async function resetUserPassword(publicId, newPassword, ctx) {
  const existing = await findUserByPublicId(publicId);
  if (!existing) throw new NotFoundError('User not found');
  if (existing.role === 'developer') {
    throw new ValidationError('Developer accounts can only be managed by the system owner');
  }

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
  if (existing.role === 'developer') {
    throw new ValidationError('Developer accounts can only be managed by the system owner');
  }
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