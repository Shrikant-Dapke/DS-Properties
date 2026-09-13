import { query, withTransaction, withTransactionJoinable } from '../config/database.js';
import { SENSITIVE_ROLE, SOURCE_TYPES, TRANSACTION_TYPES } from '../config/constants.js';
import { NotFoundError, ConflictError, AuthorizationError, AppError, ValidationError } from '../utils/errors.js';
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
import { getActivePartnerUserIds, isActivePartnerUser } from '../models/userModel.js';
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
  findDuplicatePreview,
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
// deactivates, deletes, or resets the password of an ADMIN. Everything else
// (creating/editing/deactivating/deleting a READ_ONLY user, profile edits,
// password resets for READ_ONLY users) is a direct admin action.
export function isSensitiveUserOp({ targetUser, operation, payload }) {
  if (operation === 'create') {
    return payload?.role === SENSITIVE_ROLE;
  }
  if (operation === 'delete') {
    return targetUser?.role === SENSITIVE_ROLE;
  }
  if (operation === 'update') {
    const newRole = payload?.role;
    const oldRole = targetUser?.role;
    if (newRole === SENSITIVE_ROLE) return true; // promote to admin
    if (oldRole === SENSITIVE_ROLE && newRole && newRole !== SENSITIVE_ROLE) return true; // demote
    if (payload?.isActive === false && oldRole === SENSITIVE_ROLE) return true; // deactivate admin
    if (payload?.password !== undefined && oldRole === SENSITIVE_ROLE) return true; // reset admin password
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
      if (operation === 'delete') {
        return await removeTransaction(
          entityId,
          { reason: proposedState.reason, versionTag: proposedState.versionTag ?? proposedState.expectedVersion },
          ctx,
        );
      }
      if (operation === 'reverse') {
        return await reverseExistingTransaction(
          entityId,
          { reason: proposedState.reason, versionTag: proposedState.versionTag ?? proposedState.expectedVersion },
          ctx,
        );
      }
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
          // Enforce the self-deactivation guard even on the governed apply
          // path (allowSelf=false). Direct self-deactivation is rejected in
          // submitChange; governed self-deactivation can only complete via
          // multi-admin approval, never by bypass.
          return await setUserActive(entityId, proposedState.isActive, ctx, false);
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
  // Invalidation happens after COMMIT (see below): invalidating inside the
  // transaction could expose uncommitted state to concurrent readers on
  // rollback, so capture the result here and invalidate only on success.
  const applied = await withTransaction(async () => {
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
    // Updates and destructive transaction ops (delete/reverse) all enforce
    // the snapshot versionTag when present; direct paths carry no versionTag
    // and proceed untouched.
    if ((req.operation === 'update' || req.operation === 'delete' || req.operation === 'reverse') && req.versionTag) {
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

    const entity = await applyDispatchGuarded(req, ctx, async () => applyDispatch(req, applyCtxFor(req, ctx)));
    if (entity === null) {
      // Apply failed with an operational error: the request is already in a
      // terminal CANCELLED state (see applyDispatchGuarded). Do not mark it
      // APPROVED; the caller receives the resolved request with no entity.
      return { entity: null, entityType: req.entityType };
    }

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
    return { entity, entityType: req.entityType };
  });
  if (applied && applied.entityType === 'transaction') invalidateFinancialCachePublic();
  return applied?.entity ?? null;
}

// Apply-time failures (target deleted/reversed mid-flight, referential or
// business-rule violations) must never strand a request PENDING nor surface
// as an opaque 500 to the approver. Operational errors resolve the request to
// a terminal CANCELLED state carrying the reason code; the approver gets the
// resolved request back. Unexpected errors still propagate.
//
// The apply runs behind a savepoint: SQL-state failures (unique violations,
// FK/CHECK breaches like 23505/23503/23514) abort the PostgreSQL transaction,
// so without ROLLBACK TO even the terminal-state bookkeeping below would fail
// with 25P02. Rolling back to the savepoint discards the partial mutation
// while the outer approval transaction stays healthy and commits the
// CANCELLED status plus the failure audit atomically.
async function applyDispatchGuarded(req, ctx, apply) {
  await query('SAVEPOINT gov_apply_guard');
  try {
    const result = await apply();
    await query('RELEASE SAVEPOINT gov_apply_guard');
    return result;
  } catch (err) {
    await query('ROLLBACK TO SAVEPOINT gov_apply_guard');
    const operational =
      err instanceof ValidationError || err instanceof NotFoundError || err instanceof ConflictError;
    if (!operational) throw err;
    await setStatus(req.id, 'CANCELLED', err.code || 'APPLY_FAILED');
    await logAudit({
      userId: ctx.userId,
      action: 'change_request_apply_failed',
      domain: 'governance',
      recordId: req.publicId,
      newValues: {
        entityType: req.entityType,
        entityId: req.entityId,
        reason: err.code || 'APPLY_FAILED',
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return null;
  }
}

// Attribution for governed application: business-data mutations are credited
// to the requesting partner (created_by, entity-level audit actor), while the
// change-request lifecycle audits keep crediting the deciding/finalizing user
// via the caller's ctx. Falls back to the finalizer when the requester row is
// gone (requested_by is ON DELETE SET NULL). Admin/system governance keeps
// crediting the finalizer exactly as before.
function applyCtxFor(req, ctx) {
  if (PARTNER_GOVERNED_ENTITIES.has(req.entityType) && req.requestedBy != null) {
    return { ...ctx, userId: req.requestedBy };
  }
  return ctx;
}

async function tryFinalize(request, ctx) {
  const approvals = await getApprovals(request.id);
  if (approvals.some((a) => a.status === 'REJECTED')) return null;
  const approvedIds = approvals.filter((a) => a.status === 'APPROVED').map((a) => a.adminUserId);
  if (approvedIds.length < request.requiredApprovers.length) return null;
  return finalizeApply(request, ctx);
}

// ---------------------------------------------------------------------------
// Universal partner governance for business data
// ---------------------------------------------------------------------------
// Business-data mutations (transactions, customers, categories, financial
// settings) may ONLY be proposed by active partners and apply ONLY after
// unanimous approval from ALL OTHER active partners. The requester is never
// an approver and receives no auto-approval. Approver membership is computed
// server-side from the authoritative pool and frozen on the request.
// Partner business-RECORD membership (the partners directory itself) stays
// under admin governance by design: it avoids bootstrap/growth deadlocks
// (zero partners => nobody could approve; one partner => empty quorum must
// 409, never auto-approve) while no single admin can act unilaterally.
const PARTNER_GOVERNED_ENTITIES = new Set(['transaction', 'customer', 'category', 'app_setting']);

async function submitPartnerGovernedChange({ entityType, entityId, operation, proposedState, ctx }) {
  // Requester must be an active partner with an active linked partner record.
  const requester = await isActivePartnerUser(ctx.userId);
  if (!requester) {
    throw new AuthorizationError('Only active partners can propose business-data changes');
  }

  // Required approvers: every OTHER active partner, frozen at creation time.
  // Later membership changes never mutate this snapshot.
  const pool = await getActivePartnerUserIds();
  const requiredApprovers = pool.filter((id) => id !== ctx.userId);
  if (requiredApprovers.length === 0) {
    // Safe default: never silently auto-approve merely because no other
    // partner exists. The caller must resolve the membership state first.
    throw new AppError(
      'No other active partners are available to approve this change',
      409,
      'NO_PARTNER_QUORUM',
    );
  }

  let previousState = null;
  let versionTag = null;
  if (operation !== 'create') {
    const snap = await snapshotEntity(entityType, entityId);
    previousState = snap.previousState;
    versionTag = snap.versionTag;
    // End-to-end optimistic concurrency: a client tag supplied at submit time
    // is checked against the fresh snapshot now (fail fast); the snapshot tag
    // is re-checked again atomically at apply time.
    const submittedTag = proposedState?.versionTag ?? proposedState?.expectedVersion;
    if (submittedTag !== undefined && submittedTag !== null && submittedTag !== '') {
      if (String(submittedTag) !== String(versionTag)) {
        throw new ConflictError('Record changed since you loaded it', 'STALE_CONFLICT');
      }
    }
  }

  // Fail fast on incoherent business payloads (the same classification rules
  // the service layer enforces at apply time). Without this, invalid proposals
  // would sit PENDING until an approver trips over them.
  assertSubmittable(entityType, operation, proposedState, previousState);

  // Duplicate preview for transaction creates (warning only, never a block).
  // Reference failures propagate: an unknown customer/partner/category fails
  // fast here — before any change-request row exists — instead of becoming a
  // PENDING request that can never apply.
  let meta = null;
  if (entityType === 'transaction' && operation === 'create') {
    const preview = await findDuplicatePreview(proposedState);
    meta = { duplicateWarning: preview.duplicateWarning, duplicates: preview.duplicates };
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

  // NOTE: deliberately NO requester auto-approval here. The requester is
  // never a member of requiredApprovers, so their decision can never count.

  await logAudit({
    userId: ctx.userId,
    action: 'change_request_create',
    domain: 'governance',
    recordId: request.publicId,
    newValues: { entityType, operation, entityId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  const changeRequest = await getChangeRequestByPublicId(request.publicId);
  return { changeRequest, entity: null, meta };
}

// Submit-time mirror of the service-layer classification rules, evaluated on
// the proposal merged over the snapshot (for updates). Presence-level only:
// referential existence is still verified at apply time. Keeps invalid
// proposals from ever becoming PENDING change requests.
function assertSubmittable(entityType, operation, proposedState, previousState) {
  if (entityType !== 'transaction') return;
  const prev = previousState ?? {};
  const effective = {
    transactionType: proposedState.transactionType ?? prev.transactionType,
    sourceType: proposedState.sourceType !== undefined ? proposedState.sourceType : prev.sourceType,
    customerPublicId: proposedState.customerPublicId ?? prev.customer?.publicId,
    partnerPublicId: proposedState.partnerPublicId ?? prev.partner?.publicId,
    categoryPublicId: proposedState.categoryPublicId ?? prev.category?.publicId,
  };
  if (effective.transactionType === TRANSACTION_TYPES.OUTTAKE) {
    if (!effective.categoryPublicId) {
      throw new ValidationError('Outtake requires an expense category');
    }
    if (effective.sourceType) {
      throw new ValidationError('Outtake must not have a source type');
    }
    return;
  }
  if (effective.sourceType === SOURCE_TYPES.CUSTOMER) {
    if (!effective.customerPublicId) throw new ValidationError('Customer intake requires a customer');
  } else if (
    effective.sourceType === SOURCE_TYPES.PARTNER_CAPITAL ||
    effective.sourceType === SOURCE_TYPES.PARTNER_LOAN
  ) {
    if (!effective.partnerPublicId) throw new ValidationError('Partner inflow requires a partner');
  } else {
    throw new ValidationError('Intake requires a valid source type');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function submitChange({ entityType, entityId, operation, proposedState, ctx }) {
  validateProposedState(entityType, operation, proposedState);

  // Destructive-transaction auth secret: accepted by validation above, then
  // stripped here so it can never reach change-request persistence, dispatch,
  // or audit. Controllers verify it via password re-entry before calling.
  let sanitizedState = proposedState;
  if (sanitizedState && typeof sanitizedState === 'object' && 'adminPassword' in sanitizedState) {
    sanitizedState = { ...sanitizedState };
    delete sanitizedState.adminPassword;
  }

  // Universal partner governance: every business-data mutation from a partner
  // becomes a change request. Non-partner, non-developer callers cannot pass
  // the pool check below even if they reach this path.
  if (PARTNER_GOVERNED_ENTITIES.has(entityType)) {
    // Owner bypass: the developer acts directly (fully audited) and never
    // goes through partner approval. Role comes from server-side auth context.
    if (ctx.role === 'developer') {
      const applied = await applyDirect(entityType, entityId, operation, sanitizedState, ctx);
      return {
        changeRequest: null,
        entity: applied?.entity ?? applied ?? null,
        meta: applied?.meta ?? null,
      };
    }
    return submitPartnerGovernedChange({ entityType, entityId, operation, proposedState: sanitizedState, ctx });
  }

  // Only SENSITIVE user operations (creating/promoting/demoting/deactivating/
  // deleting an admin, or resetting an admin password) go through multi-admin
  // approval. Everything else applies immediately; we still return the unified
  // envelope for a consistent client contract.
  let targetUser = null;
  if (entityType === 'user' && operation !== 'create') {
    const row = await findUserByPublicId(entityId);
    if (!row) throw new NotFoundError('User not found');
    targetUser = { id: row.id, role: row.role, isActive: row.is_active };
    // Developer accounts are owner-managed only: fail fast before any change
    // request can be created for or from a developer identity via the API.
    if (row.role === 'developer' || sanitizedState?.role === 'developer') {
      throw new ValidationError('Developer accounts can only be managed by the system owner');
    }
    // Self-guard: an admin can never deactivate or delete their own account
    // directly. Reject here so no dangling PENDING ticket is left; governed
    // self-deactivation/delete can only ever complete via another admin's
    // approval path, never by bypass.
    if (row.id === ctx.userId) {
      if (operation === 'delete') {
        throw new ValidationError('You cannot delete your own account');
      }
      if (operation === 'update' && sanitizedState?.isActive === false) {
        throw new ValidationError('You cannot deactivate your own account');
      }
    }
  }
  const sensitive = entityType === 'user' && isSensitiveUserOp({ targetUser, operation, payload: sanitizedState });

  if (!sensitive) {
    const applied = await applyDirect(entityType, entityId, operation, sanitizedState, ctx);
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
    proposedState: sanitizedState,
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
  // Every direct apply is atomic: entity mutation plus audit rows commit or
  // roll back together. withTransactionJoinable joins any outer transaction
  // when present, otherwise opens one for this dispatch. Cache invalidation
  // runs only after the transaction commits (never inside it).
  if (entityType === 'transaction') {
    const applied = await withTransactionJoinable(async () => {
      const result = await applyDispatch({ entityType, operation, entityId, proposedState }, ctx);
      const resulting = result?.entity ?? result;
      await logAudit({
        userId: ctx.userId,
        action: `${entityType}_${operation}`,
        domain: entityType,
        recordId: resulting?.publicId ?? entityId,
        newValues: { operation },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return result;
    });
    invalidateFinancialCachePublic();
    return applied;
  }
  const applied = await withTransactionJoinable(async () => {
    const result = await applyDispatch({ entityType, operation, entityId, proposedState }, ctx);
    const resulting = result?.entity ?? result;
    await logAudit({
      userId: ctx.userId,
      action: `${entityType}_${operation}`,
      domain: entityType,
      recordId: resulting?.publicId ?? entityId,
      newValues: { operation },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return result;
  });
  // Opening-balance changes affect financial aggregates; invalidate only after
  // the transaction commits. updateSetting may already have invalidated
  // inside the transaction — this post-commit call is the authoritative one.
  if (entityType === 'app_setting' && entityId === 'opening_balance') invalidateFinancialCachePublic();
  return applied;
}

// ---------------------------------------------------------------------------
// Per-viewer decision state (authoritative UI authorization state)
// ---------------------------------------------------------------------------
// The approvals UI must never infer eligibility from role alone: a partner
// may decide a request ONLY when they are a member of its frozen
// requiredApprovers snapshot and have not decided yet. This helper mirrors
// exactly what loadPending() enforces on approve/reject, so the buttons the
// UI renders can never disagree with what the server will accept. In
// particular the requester is never a member of their own snapshot and
// therefore always receives viewerCanDecide: false.
export function viewerDecisionState(request, viewerId) {
  const id = String(viewerId ?? '');
  const inSnapshot = (request.requiredApprovers || []).map(String).includes(id);
  const mine = (request.approvals || []).find((a) => String(a.adminUserId) === id);
  return {
    viewerCanDecide: request.status === 'PENDING' && inSnapshot && !mine,
    viewerDecision: mine ? mine.status : null,
  };
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

export async function cancelChange(publicId, adminUser, reasonOrCtx, ctxMaybe) {
  // Signature is (publicId, adminUser, reason, ctx); tolerate the legacy
  // 3-arg call (publicId, adminUser, ctx) so older callers keep working.
  let reason = null;
  let ctx = ctxMaybe;
  if (ctx === undefined && reasonOrCtx && typeof reasonOrCtx === 'object'
    && ('userId' in reasonOrCtx || 'ip' in reasonOrCtx)) {
    ctx = reasonOrCtx;
  } else if (reasonOrCtx !== undefined && reasonOrCtx !== null) {
    reason = typeof reasonOrCtx === 'object'
      ? (reasonOrCtx.reason ?? reasonOrCtx.comment ?? null)
      : reasonOrCtx;
  }
  const request = await getChangeRequestByPublicId(publicId);
  if (!request) throw new NotFoundError('Change request not found');
  if (request.status !== 'PENDING') {
    throw new ConflictError('Only pending change requests can be cancelled', 'ALREADY_RESOLVED');
  }
  // Authorization mirrors the approval gate: only the requester or a member
  // of the snapshotted requiredApprovers may cancel a pending request.
  if (adminUser.id !== request.requestedBy && !request.requiredApprovers.includes(adminUser.id)) {
    throw new AuthorizationError('You are not authorized to cancel this change request');
  }
  const trimmed = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  await setStatus(request.id, 'CANCELLED', trimmed ?? 'CANCELLED_BY_ADMIN');
  await logAudit({
    userId: adminUser.id,
    action: 'change_request_cancel',
    domain: 'governance',
    recordId: request.publicId,
    newValues: trimmed ? { reason: trimmed } : undefined,
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
