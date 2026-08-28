import { withTransaction } from '../config/database.js';
import { SENSITIVE_ROLE } from '../config/constants.js';
import { NotFoundError, ConflictError, AuthorizationError, AppError } from '../utils/errors.js';
import { logAudit } from './auditService.js';
import { invalidateFinancialCachePublic } from './dashboardService.js';

import {
  createChangeRequest,
  addApproval,
  getApprovals,
  getChangeRequestForUpdate,
  getChangeRequestByPublicId,
  setStatus,
  getActiveAdminIds,
  listChangeRequests,
} from '../models/changeRequestModel.js';
import { validateProposedState } from '../validators/governanceValidators.js';

import {
  findTransactionByPublicId,
} from '../models/transactionModel.js';
import {
  findCustomerByPublicId,
} from '../models/customerModel.js';
import {
  findPartnerByPublicId,
} from '../models/partnerModel.js';
import {
  findCategoryByPublicId,
} from '../models/categoryModel.js';
import { findUserByPublicId } from '../models/userModel.js';
import { getSetting } from '../models/settingsModel.js';

import {
  addTransaction,
  updateExistingTransaction,
  removeTransaction,
  reverseExistingTransaction,
  getTransaction,
} from './transactionService.js';
import {
  createNewCustomer,
  updateExistingCustomer,
  deleteCustomer,
  getCustomer,
} from './customerService.js';
import {
  createNewPartner,
  updateExistingPartner,
  deletePartner,
  getPartner,
} from './partnerService.js';
import {
  createNewCategory,
  updateExistingCategory,
  deleteCategory,
  getCategory,
} from './categoryService.js';
import {
  createNewUser,
  updateExistingUser,
  setUserActive,
  resetUserPassword,
  deleteUser,
} from './userService.js';
import { updateSetting } from './settingsService.js';

// ---------------------------------------------------------------------------
// Sensitive user-operation classification (partial governance)
// ---------------------------------------------------------------------------
// A user mutation is governed only when it creates, promotes to, demotes from,
// or deactivates an ADMIN. Everything else (creating/editing/deactivating a
// READ_ONLY user, profile edits, password resets) is a direct admin action.
export function isSensitiveUserOp({ targetUser, operation, payload }) {
  if (operation === 'create') {
    return payload?.role === SENSITIVE_ROLE;
  }
  if (operation === 'update') {
    const newRole = payload?.role;
    const oldRole = targetUser?.role;
    if (newRole === SENSITIVE_ROLE) return true; // promote to admin
    if (oldRole === SENSITIVE_ROLE && newRole && newRole !== SENSITIVE_ROLE) return true; // demote
    if (payload?.isActive === false && oldRole === SENSITIVE_ROLE) return true; // deactivate admin
  }
  return false;
}

// ---------------------------------------------------------------------------
// Snapshot helpers (optimistic concurrency + BEFORE display)
// ---------------------------------------------------------------------------
async function snapshotEntity(entityType, entityId) {
  switch (entityType) {
    case 'transaction': {
      const row = await findTransactionByPublicId(entityId);
      if (!row) throw new NotFoundError('Transaction not found');
      return { previousState: await getTransaction(entityId), versionTag: iso(row.updated_at) };
    }
    case 'customer': {
      const row = await findCustomerByPublicId(entityId);
      if (!row) throw new NotFoundError('Customer not found');
      return { previousState: await getCustomer(entityId), versionTag: iso(row.updated_at) };
    }
    case 'partner': {
      const row = await findPartnerByPublicId(entityId);
      if (!row) throw new NotFoundError('Partner not found');
      return { previousState: await getPartner(entityId), versionTag: iso(row.updated_at) };
    }
    case 'category': {
      const row = await findCategoryByPublicId(entityId);
      if (!row) throw new NotFoundError('Category not found');
      return { previousState: await getCategory(entityId), versionTag: iso(row.updated_at) };
    }
    case 'user': {
      const row = await findUserByPublicId(entityId);
      if (!row) throw new NotFoundError('User not found');
      return {
        previousState: {
          publicId: row.public_id,
          username: row.username,
          fullName: row.full_name,
          email: row.email,
          phone: row.phone,
          role: row.role,
          isActive: row.is_active,
        },
        versionTag: iso(row.updated_at),
      };
    }
    case 'app_setting': {
      const row = await getSetting(entityId);
      if (!row) throw new NotFoundError('Setting not found');
      return { previousState: row, versionTag: iso(row.updated_at) };
    }
    default:
      return { previousState: null, versionTag: null };
  }
}

async function getCurrentVersion(entityType, entityId) {
  switch (entityType) {
    case 'transaction': {
      const r = await findTransactionByPublicId(entityId);
      return r ? iso(r.updated_at) : null;
    }
    case 'customer': {
      const r = await findCustomerByPublicId(entityId);
      return r ? iso(r.updated_at) : null;
    }
    case 'partner': {
      const r = await findPartnerByPublicId(entityId);
      return r ? iso(r.updated_at) : null;
    }
    case 'category': {
      const r = await findCategoryByPublicId(entityId);
      return r ? iso(r.updated_at) : null;
    }
    case 'user': {
      const r = await findUserByPublicId(entityId);
      return r ? iso(r.updated_at) : null;
    }
    case 'app_setting': {
      const r = await getSetting(entityId);
      return r ? iso(r.updated_at) : null;
    }
    default:
      return null;
  }
}

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

// ---------------------------------------------------------------------------
// Apply dispatch (runs inside the approval transaction)
// ---------------------------------------------------------------------------
async function applyDispatch(request, ctx) {
  const { entityType, operation, entityId, proposedState } = request;
  switch (entityType) {
    case 'transaction':
      if (operation === 'create') {
        const r = await addTransaction(proposedState, ctx);
        return { entity: r.transaction, meta: { duplicateWarning: r.duplicateWarning, duplicates: r.duplicates } };
      }
      if (operation === 'update') return await updateExistingTransaction(entityId, proposedState, ctx);
      if (operation === 'delete') return await removeTransaction(entityId, { reason: proposedState.reason }, ctx);
      if (operation === 'reverse') return await reverseExistingTransaction(entityId, { reason: proposedState.reason }, ctx);
      break;
    case 'customer':
      if (operation === 'create') return await createNewCustomer(proposedState, ctx);
      if (operation === 'update') return await updateExistingCustomer(entityId, proposedState, ctx);
      if (operation === 'delete') return await deleteCustomer(entityId, ctx);
      break;
    case 'partner':
      if (operation === 'create') return await createNewPartner(proposedState, ctx);
      if (operation === 'update') return await updateExistingPartner(entityId, proposedState, ctx);
      if (operation === 'delete') return await deletePartner(entityId, ctx);
      break;
    case 'category':
      if (operation === 'create') return await createNewCategory(proposedState, ctx);
      if (operation === 'update') return await updateExistingCategory(entityId, proposedState, ctx);
      if (operation === 'delete') return await deleteCategory(entityId, ctx);
      break;
    case 'user':
      if (operation === 'create') return await createNewUser(proposedState, ctx);
      if (operation === 'update') {
        if (proposedState.isActive !== undefined) {
          return await setUserActive(entityId, proposedState.isActive, ctx, true);
        }
        if (proposedState.password !== undefined) {
          await resetUserPassword(entityId, proposedState.password, ctx);
          const rest = { ...proposedState };
          delete rest.password;
          return await updateExistingUser(entityId, rest, ctx);
        }
        return await updateExistingUser(entityId, proposedState, ctx);
      }
      if (operation === 'delete') return await deleteUser(entityId, ctx);
      break;
    case 'app_setting':
      if (operation === 'update') return await updateSetting(entityId, proposedState.value, ctx);
      break;
    default:
      break;
  }
  throw new AppError(`Cannot apply ${entityType}.${operation}`, 400, 'UNGOVERNABLE');
}

// ---------------------------------------------------------------------------
// Finalize: lock, re-verify, apply atomically
// ---------------------------------------------------------------------------
async function finalizeApply(request, ctx) {
  return withTransaction(async () => {
    const req = await getChangeRequestForUpdate(request.id);
    if (req.status !== 'PENDING') return null;

    const approvals = await getApprovals(req.id);
    if (approvals.some((a) => a.status === 'REJECTED')) {
      const reason = approvals.find((a) => a.status === 'REJECTED')?.comment || 'Rejected';
      await setStatus(req.id, 'REJECTED', reason);
      return null;
    }

    const approvedIds = approvals
      .filter((a) => a.status === 'APPROVED')
      .map((a) => a.adminUserId);
    if (approvedIds.length !== req.requiredApprovers.length) {
      return null; // not yet fully approved
    }

    // Optimistic concurrency: refuse to silently overwrite newer data.
    if (req.operation === 'update' && req.versionTag) {
      const current = await getCurrentVersion(req.entityType, req.entityId);
      if (current !== null && current !== req.versionTag) {
        await setStatus(req.id, 'CANCELLED', 'STALE_CONFLICT');
        await logAudit({
          userId: ctx.userId,
          action: 'change_request_stale',
          domain: 'governance',
          recordId: req.publicId,
          newValues: { entityType: req.entityType, entityId: req.entityId },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
        return null;
      }
    }

    const entity = await applyDispatch(req, ctx);
    if (req.entityType === 'transaction') invalidateFinancialCachePublic();

    await setStatus(req.id, 'APPROVED', null);
    await logAudit({
      userId: ctx.userId,
      action: 'change_request_apply',
      domain: 'governance',
      recordId: req.publicId,
      newValues: { entityType: req.entityType, operation: req.operation },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return entity;
  });
}

async function tryFinalize(request, ctx) {
  const approvals = await getApprovals(request.id);
  if (approvals.some((a) => a.status === 'REJECTED')) return null;
  const approvedIds = approvals.filter((a) => a.status === 'APPROVED').map((a) => a.adminUserId);
  if (approvedIds.length < request.requiredApprovers.length) return null;
  return finalizeApply(request, ctx);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function submitChange({ entityType, entityId, operation, proposedState, ctx }) {
  validateProposedState(entityType, operation, proposedState);

  // Only SENSITIVE user operations (creating/promoting/demoting/deactivating an
  // admin) go through multi-admin approval. Everything else applies immediately;
  // we still return the unified envelope for a consistent client contract.
  let targetUser = null;
  if (entityType === 'user' && operation !== 'create') {
    const row = await findUserByPublicId(entityId);
    if (!row) throw new NotFoundError('User not found');
    targetUser = { role: row.role, isActive: row.is_active };
  }
  const sensitive = entityType === 'user' && isSensitiveUserOp({ targetUser, operation, payload: proposedState });

  if (!sensitive) {
    const applied = await applyDirect(entityType, entityId, operation, proposedState, ctx);
    return {
      changeRequest: null,
      entity: applied?.entity ?? applied ?? null,
      meta: applied?.meta ?? null,
    };
  }

  const requiredApprovers = await getActiveAdminIds();
  if (!requiredApprovers.length) {
    throw new AppError('No active admin is available to approve this change', 409, 'NO_APPROVER');
  }

  let previousState = null;
  let versionTag = null;
  if (operation !== 'create') {
    const snap = await snapshotEntity(entityType, entityId);
    previousState = snap.previousState;
    versionTag = snap.versionTag;
  }

  const request = await createChangeRequest({
    entityType,
    entityId,
    operation,
    requestedBy: ctx.userId,
    previousState,
    proposedState,
    requiredApprovers,
    versionTag,
  });

  // The requester is an admin; their approval counts as their own.
  await addApproval({
    changeRequestId: request.id,
    adminUserId: ctx.userId,
    status: 'APPROVED',
    comment: 'Requester',
  });

  await logAudit({
    userId: ctx.userId,
    action: 'change_request_create',
    domain: 'governance',
    recordId: request.publicId,
    newValues: { entityType, operation, entityId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  const applied = await tryFinalize(request, ctx);
  const changeRequest = await getChangeRequestByPublicId(request.publicId);
  return {
    changeRequest,
    entity: applied?.entity ?? applied ?? null,
    meta: applied?.meta ?? null,
  };
}

async function applyDirect(entityType, entityId, operation, proposedState, ctx) {
  const applied = await applyDispatch({ entityType, operation, entityId, proposedState }, ctx);
  if (entityType === 'transaction') invalidateFinancialCachePublic();
  const resulting = applied?.entity ?? applied;
  await logAudit({
    userId: ctx.userId,
    action: `${entityType}_${operation}`,
    domain: entityType,
    recordId: resulting?.publicId ?? entityId,
    newValues: { operation },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return applied;
}

async function loadPending(publicId, adminUser) {
  const request = await getChangeRequestByPublicId(publicId);
  if (!request) throw new NotFoundError('Change request not found');
  if (request.status !== 'PENDING') {
    throw new ConflictError('Change request is already resolved', 'ALREADY_RESOLVED');
  }
  if (!request.requiredApprovers.includes(adminUser.id)) {
    throw new AuthorizationError('You are not a required approver for this change');
  }
  if (request.approvals.some((a) => a.adminUserId === adminUser.id)) {
    throw new ConflictError('You have already decided on this change request', 'DUPLICATE_APPROVAL');
  }
  return request;
}

export async function approveChange(publicId, adminUser, comment, ctx) {
  const request = await loadPending(publicId, adminUser);
  await addApproval({
    changeRequestId: request.id,
    adminUserId: adminUser.id,
    status: 'APPROVED',
    comment: comment || null,
  });
  await logAudit({
    userId: adminUser.id,
    action: 'change_request_approve',
    domain: 'governance',
    recordId: request.publicId,
    newValues: { comment: comment || null },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  const applied = await tryFinalize(request, ctx);
  return {
    changeRequest: await getChangeRequestByPublicId(publicId),
    entity: applied?.entity ?? applied ?? null,
    meta: applied?.meta ?? null,
  };
}

export async function rejectChange(publicId, adminUser, comment, ctx) {
  const request = await loadPending(publicId, adminUser);
  await addApproval({
    changeRequestId: request.id,
    adminUserId: adminUser.id,
    status: 'REJECTED',
    comment: comment || null,
  });
  await setStatus(request.id, 'REJECTED', comment || 'Rejected without reason');
  await logAudit({
    userId: adminUser.id,
    action: 'change_request_reject',
    domain: 'governance',
    recordId: request.publicId,
    newValues: { comment: comment || null },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return { changeRequest: await getChangeRequestByPublicId(publicId), entity: null };
}

export async function cancelChange(publicId, adminUser, ctx) {
  const request = await getChangeRequestByPublicId(publicId);
  if (!request) throw new NotFoundError('Change request not found');
  if (request.status !== 'PENDING') {
    throw new ConflictError('Only pending change requests can be cancelled', 'ALREADY_RESOLVED');
  }
  await setStatus(request.id, 'CANCELLED', 'CANCELLED_BY_ADMIN');
  await logAudit({
    userId: adminUser.id,
    action: 'change_request_cancel',
    domain: 'governance',
    recordId: request.publicId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return { changeRequest: await getChangeRequestByPublicId(publicId), entity: null };
}

export async function listChangeRequestsForApi({ status, entityType, requestedBy, _page, limit, offset }) {
  const { total, rows } = await listChangeRequests({
    status,
    entityType,
    requestedBy,
    limit,
    offset,
  });
  return { total, rows };
}
