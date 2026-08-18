import mongoose from 'mongoose';
import ChangeRequest from '../models/ChangeRequest.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { writeAudit } from './audit.service.js';
import {
  syncTransaction,
  removeTransaction,
  FINANCIAL_ENTITY_TYPES,
} from './finance.service.js';

const isFinancial = (entityType) => FINANCIAL_ENTITY_TYPES.includes(entityType);

import Plot from '../models/Plot.js';
import Customer from '../models/Customer.js';
import Partner from '../models/Partner.js';
import Category from '../models/Category.js';
import Expense from '../models/Expense.js';
import Income from '../models/Income.js';
import Payment from '../models/Payment.js';
import PartnerCapital from '../models/PartnerCapital.js';
import LoanReceived from '../models/LoanReceived.js';

const ENTITY_MODELS = {
  Plot,
  Customer,
  Partner,
  Category,
  Expense,
  Income,
  Payment,
  PartnerCapital,
  LoanReceived,
};
const ENTITY_TYPES = Object.keys(ENTITY_MODELS);
const OPERATIONS = ['create', 'update', 'delete'];

function getModel(entityType) {
  const m = ENTITY_MODELS[entityType];
  if (!m) {
    throw new AppError(`Unsupported entity type: ${entityType}`, 400);
  }
  return m;
}

function isDecimalPath(model, field) {
  const path = model.schema.paths[field];
  return !!(path && path.instance === 'Decimal128');
}

function toStoredValue(model, field, value) {
  if (isDecimalPath(model, field)) {
    if (value === '' || value === null || value === undefined) return null;
    return String(value).trim();
  }
  return value;
}

function toDisplayValue(model, field, value) {
  if (isDecimalPath(model, field) && value != null) {
    return value.toString();
  }
  return value;
}

async function getActivePartnerUserIds() {
  const users = await User.find({ role: 'partner', active: true }).select(
    '_id'
  );
  return users.map((u) => u._id);
}

async function populateCR(cr) {
  await cr.populate('requestedBy', 'name role');
  await cr.populate('approvals.partnerId', 'name');
  return cr;
}

async function commitChangeRequest(cr, committedBy, { session = null } = {}) {
  const model = getModel(cr.entityType);
  const doWork = async (sess) => {
    let entityForAudit = cr.entityId || cr._id;

    if (cr.operation === 'create') {
      const data = {};
      for (const c of cr.changes) data[c.field] = c.newValue;
      const created = await model.create([data], { session: sess });
      entityForAudit = created[0]._id;
      cr.entityId = created[0]._id;
      if (isFinancial(cr.entityType)) {
        await syncTransaction(cr.entityType, created[0], {
          committedBy,
          operation: 'create',
          session: sess,
        });
      }
    } else if (cr.operation === 'update') {
      const doc = await model.findById(cr.entityId).session(sess);
      if (!doc) throw new AppError(`${cr.entityType} not found`, 404);
      for (const c of cr.changes) {
        const current = toDisplayValue(model, c.field, doc.get(c.field));
        if (String(current) !== String(c.oldValue)) {
          throw new AppError(
            'Official data changed since this request was created; cannot safely commit',
            409
          );
        }
        doc.set(c.field, c.newValue);
      }
      await doc.save({ session: sess });
      if (isFinancial(cr.entityType)) {
        await syncTransaction(cr.entityType, doc, {
          committedBy,
          operation: 'update',
          session: sess,
        });
      }
    } else if (cr.operation === 'delete') {
      const doc = await model.findByIdAndDelete(cr.entityId).session(sess);
      if (!doc) throw new AppError(`${cr.entityType} not found`, 404);
      if (isFinancial(cr.entityType)) {
        await removeTransaction(cr.entityType, cr.entityId, { session: sess });
      }
    }

    cr.status = 'COMMITTED';
    cr.committedAt = new Date();
    cr.committedBy = committedBy;
    await cr.save({ session: sess });

    for (const c of cr.changes) {
      await writeAudit({
        actorId: committedBy,
        actorRole: 'partner',
        changeRequestId: cr._id,
        entityType: cr.entityType,
        entityId: entityForAudit,
        operation: cr.operation,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
      });
    }
    await writeAudit({
      actorId: committedBy,
      actorRole: 'partner',
      changeRequestId: cr._id,
      entityType: cr.entityType,
      entityId: entityForAudit,
      operation: 'commit',
    });
  };

  const useSession = session || (await mongoose.startSession());
  try {
    if (session) {
      await doWork(session);
    } else {
      await useSession.withTransaction(async () => {
        await doWork(useSession);
      });
    }
  } finally {
    if (!session) await useSession.endSession();
  }
  return cr;
}

export async function createChangeRequest({
  requestedBy,
  entityType,
  entityId,
  operation,
  changes,
}) {
  if (!ENTITY_TYPES.includes(entityType)) {
    throw new AppError(`Unsupported entity type: ${entityType}`, 400);
  }
  if (!OPERATIONS.includes(operation)) {
    throw new AppError(`Invalid operation: ${operation}`, 400);
  }

  const model = getModel(entityType);
  let doc = null;
  let resolvedEntityId = null;

  if (operation === 'update' || operation === 'delete') {
    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      throw new AppError('Invalid entity id', 400);
    }
    doc = await model.findById(entityId);
    if (!doc) throw new AppError(`${entityType} not found`, 404);
    resolvedEntityId = doc._id;
  }

  const builtChanges = [];
  if (operation !== 'delete') {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new AppError('At least one change is required', 400);
    }
    for (const c of changes) {
      const field = String(c.field || '').trim();
      if (!field) throw new AppError('Each change requires a field', 400);
      if (!model.schema.paths[field]) {
        throw new AppError(`Unknown field "${field}" on ${entityType}`, 400);
      }
      let oldValue = null;
      if (operation === 'update') {
        oldValue = toDisplayValue(model, field, doc.get(field));
      }
      const newValue = toStoredValue(model, field, c.newValue);
      builtChanges.push({ field, oldValue, newValue });
    }
  }

  const activePartners = await getActivePartnerUserIds();
  const requiredApprovers = activePartners
    .map((id) => id.toString())
    .filter((id) => id !== requestedBy.toString());

  const cr = await ChangeRequest.create({
    entityType,
    entityId: resolvedEntityId,
    operation,
    requestedBy,
    status: requiredApprovers.length === 0 ? 'COMMITTED' : 'PENDING',
    changes: builtChanges,
    approvals: [
      { partnerId: requestedBy, action: 'requested', at: new Date() },
    ],
    requiredApprovers,
  });

  if (requiredApprovers.length === 0) {
    await commitChangeRequest(cr, requestedBy);
  }

  return populateCR(cr);
}

export async function listChangeRequests({ user }) {
  let filter = {};
  if (user.role === 'developer') {
    filter = {};
  } else if (user.role === 'partner') {
    filter = {
      $or: [
        { requestedBy: user._id },
        { requiredApprovers: user._id, status: 'PENDING' },
      ],
    };
  } else {
    filter = { _id: null };
  }
  const items = await ChangeRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('requestedBy', 'name role')
    .populate('approvals.partnerId', 'name');
  return items;
}

export async function getChangeRequest({ id, user }) {
  const cr = await ChangeRequest.findById(id)
    .populate('requestedBy', 'name role')
    .populate('approvals.partnerId', 'name');
  if (!cr) throw new AppError('Change request not found', 404);
  if (user.role === 'admin') throw new AppError('Forbidden', 403);
  if (user.role === 'partner') {
    const isRequester = user._id.toString() === cr.requestedBy._id.toString();
    const isApprover = cr.requiredApprovers.some(
      (p) => p.toString() === user._id.toString()
    );
    if (!isRequester && !isApprover) throw new AppError('Forbidden', 403);
  }
  return cr;
}

export async function approveChangeRequest({ requestId, approver }) {
  const cr = await ChangeRequest.findById(requestId);
  if (!cr) throw new AppError('Change request not found', 404);
  if (cr.status !== 'PENDING') {
    throw new AppError(`Cannot approve a request that is ${cr.status}`, 409);
  }
  if (approver.role !== 'partner') {
    throw new AppError('Only partners can approve', 403);
  }
  if (!approver.active) {
    throw new AppError('Inactive partners cannot approve', 403);
  }
  if (approver._id.toString() === cr.requestedBy.toString()) {
    throw new AppError('You cannot approve your own request', 403);
  }

  const currentRequired = (await getActivePartnerUserIds()).map((id) =>
    id.toString()
  );
  if (!currentRequired.includes(approver._id.toString())) {
    throw new AppError(
      'You are not an eligible approver for this request',
      403
    );
  }
  if (
    cr.approvals.some(
      (a) =>
        a.partnerId.toString() === approver._id.toString() &&
        a.action === 'approved'
    )
  ) {
    throw new AppError('You have already approved this request', 409);
  }

  cr.approvals.push({
    partnerId: approver._id,
    action: 'approved',
    at: new Date(),
  });

  const approvedSet = new Set(
    cr.approvals
      .filter((a) => a.action === 'approved')
      .map((a) => a.partnerId.toString())
  );
  const requiredSet = new Set(
    currentRequired.filter((id) => id !== cr.requestedBy.toString())
  );
  const allApproved = [...requiredSet].every((id) => approvedSet.has(id));

  await writeAudit({
    actorId: approver._id,
    actorRole: 'partner',
    changeRequestId: cr._id,
    entityType: cr.entityType,
    entityId: cr.entityId || cr._id,
    operation: 'approve',
    note: approver.name,
  });

  if (allApproved) {
    await commitChangeRequest(cr, cr.requestedBy);
  } else {
    await cr.save();
  }
  return populateCR(cr);
}

export async function rejectChangeRequest({ requestId, rejector, reason }) {
  const cr = await ChangeRequest.findById(requestId);
  if (!cr) throw new AppError('Change request not found', 404);
  if (cr.status !== 'PENDING') {
    throw new AppError(`Cannot reject a request that is ${cr.status}`, 409);
  }
  if (rejector.role !== 'partner') {
    throw new AppError('Only partners can reject', 403);
  }
  if (!rejector.active) {
    throw new AppError('Inactive partners cannot reject', 403);
  }
  if (rejector._id.toString() === cr.requestedBy.toString()) {
    throw new AppError('You cannot reject your own request', 403);
  }
  const currentRequired = (await getActivePartnerUserIds()).map((id) =>
    id.toString()
  );
  if (!currentRequired.includes(rejector._id.toString())) {
    throw new AppError(
      'You are not an eligible reviewer for this request',
      403
    );
  }
  if (!reason || !String(reason).trim()) {
    throw new AppError('A rejection reason is required', 400);
  }
  const note = String(reason).trim();

  cr.approvals.push({
    partnerId: rejector._id,
    action: 'rejected',
    at: new Date(),
    note,
  });
  cr.status = 'REJECTED';
  cr.rejectionReason = note;
  await cr.save();

  await writeAudit({
    actorId: rejector._id,
    actorRole: 'partner',
    changeRequestId: cr._id,
    entityType: cr.entityType,
    entityId: cr.entityId || cr._id,
    operation: 'reject',
    note,
  });
  return populateCR(cr);
}

export async function cancelChangeRequest({ requestId, user }) {
  const cr = await ChangeRequest.findById(requestId);
  if (!cr) throw new AppError('Change request not found', 404);
  if (cr.status !== 'PENDING') {
    throw new AppError(`Cannot cancel a request that is ${cr.status}`, 409);
  }
  const isRequester = user._id.toString() === cr.requestedBy.toString();
  const isDeveloper = user.role === 'developer';
  if (!isRequester && !isDeveloper) {
    throw new AppError(
      'Only the requester or a developer can cancel this request',
      403
    );
  }
  cr.status = 'CANCELLED';
  await cr.save();
  return populateCR(cr);
}

export async function resubmitChangeRequest({ requestId, user }) {
  const cr = await ChangeRequest.findById(requestId);
  if (!cr) throw new AppError('Change request not found', 404);
  if (cr.status !== 'REJECTED') {
    throw new AppError('Only rejected requests can be resubmitted', 409);
  }
  if (user._id.toString() !== cr.requestedBy.toString()) {
    throw new AppError('Only the requester can resubmit', 403);
  }
  const active = await getActivePartnerUserIds();
  const requiredApprovers = active
    .map((id) => id.toString())
    .filter((id) => id !== user._id.toString());

  const newCr = await ChangeRequest.create({
    entityType: cr.entityType,
    entityId: cr.entityId,
    operation: cr.operation,
    requestedBy: user._id,
    status: requiredApprovers.length === 0 ? 'COMMITTED' : 'PENDING',
    changes: cr.changes,
    approvals: [{ partnerId: user._id, action: 'requested', at: new Date() }],
    requiredApprovers,
  });

  if (requiredApprovers.length === 0) {
    await commitChangeRequest(newCr, user._id);
  }
  return populateCR(newCr);
}
