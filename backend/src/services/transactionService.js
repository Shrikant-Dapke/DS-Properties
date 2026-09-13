import {
  createTransaction,
  findTransactionByPublicId,
  listTransactions,
  findPotentialDuplicates,
  softDeleteTransaction,
  updateTransaction,
  reverseTransaction as modelReverseTransaction,
} from '../models/transactionModel.js';
import { findCustomerByPublicId } from '../models/customerModel.js';
import { findPartnerByPublicId } from '../models/partnerModel.js';
import { findCategoryByPublicId } from '../models/categoryModel.js';
import { logAudit } from './auditService.js';
import { withTransactionJoinable } from '../config/database.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { AUDIT_ACTIONS, SOURCE_TYPES, TRANSACTION_TYPES } from '../config/constants.js';

function versionOf(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function assertFresh(tx, expectedVersion) {
  if (expectedVersion === undefined || expectedVersion === null || expectedVersion === '') return;
  if (versionOf(tx.updated_at) !== String(expectedVersion)) {
    throw new ConflictError('Transaction changed since you loaded it', 'STALE_CONFLICT');
  }
}

function serialize(tx) {
  return {
    publicId: tx.public_id,
    transactionType: tx.transaction_type,
    sourceType: tx.source_type,
    customer: tx.customer_public_id
      ? { publicId: tx.customer_public_id, name: tx.customer_name }
      : null,
    partner: tx.partner_public_id
      ? { publicId: tx.partner_public_id, name: tx.partner_name }
      : null,
    category: tx.category_public_id
      ? { publicId: tx.category_public_id, name: tx.category_name }
      : null,
    amount: tx.amount,
    paymentMode: tx.payment_mode,
    transactionDate: tx.transaction_date,
    referenceNumber: tx.reference_number,
    plotNumber: tx.plot_number,
    paidTo: tx.paid_to,
    description: tx.description,
    isReversal: tx.is_reversal,
    reversedFrom: tx.reversed_from_id,
    reversedAt: tx.reversed_at,
    reversalReason: tx.reversal_reason,
    createdBy: tx.created_by_public_id
      ? { publicId: tx.created_by_public_id, username: tx.created_by_username }
      : null,
    createdAt: tx.created_at,
    // Optimistic-concurrency source: clients read versionTag (or updatedAt)
    // from GET and echo it back as versionTag on update/delete/reverse.
    // Absent tags proceed untouched so existing clients keep working.
    updatedAt: tx.updated_at,
    versionTag: versionOf(tx.updated_at),
  };
}

async function resolveReferences(data) {
  let customerId = null;
  let partnerId = null;
  let categoryId = null;

  if (data.customerPublicId) {
    const c = await findCustomerByPublicId(data.customerPublicId);
    if (!c) throw new ValidationError('Customer not found');
    customerId = c.id;
  }
  if (data.partnerPublicId) {
    const p = await findPartnerByPublicId(data.partnerPublicId);
    if (!p || !p.is_active) throw new ValidationError('Partner not found or inactive');
    partnerId = p.id;
  }
  if (data.categoryPublicId) {
    const cat = await findCategoryByPublicId(data.categoryPublicId);
    if (!cat) throw new ValidationError('Category not found');
    categoryId = cat.id;
  }

  return { customerId, partnerId, categoryId };
}

export async function addTransaction(data, ctx) {
  const { customerId, partnerId, categoryId } = await resolveReferences(data);

  const txData = {
    transaction_type: data.transactionType,
    source_type: data.sourceType ?? null,
    customer_id: customerId,
    partner_id: partnerId,
    expense_category_id: categoryId,
    amount: data.amount,
    payment_mode: data.paymentMode,
    transaction_date: data.transactionDate,
    reference_number: data.referenceNumber,
    plot_number: data.plotNumber,
    paid_to: data.paidTo,
    description: data.description,
    created_by: ctx.userId,
  };

  // Database-level classification guard: reject incoherent combinations before
  // hitting the CHECK constraint so the error is clear.
  validateClassification(txData);

  const { duplicateWarning, duplicates } = await findDuplicatePreview(data);

  const tx = await withTransactionJoinable(async () => {
    const created = await createTransaction(txData);

    await logAudit({
      userId: ctx.userId,
      action: AUDIT_ACTIONS.CREATE,
      domain: 'transactions',
      recordId: created.public_id,
      newValues: {
        type: created.transaction_type,
        source: created.source_type,
        amount: created.amount,
        date: created.transaction_date,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return created;
  });

  return {
    transaction: serialize(tx),
    duplicateWarning,
    duplicates,
  };
}

// Submit-time duplicate preview for governed creates: same detection as
// addTransaction, without writing anything. Lets the proposer warn about a
// possible duplicate up front; the check runs again at apply time.
export async function findDuplicatePreview(data) {
  const { customerId, partnerId, categoryId } = await resolveReferences(data);
  const duplicates = await findPotentialDuplicates({
    transactionType: data.transactionType,
    sourceType: data.sourceType ?? null,
    amount: data.amount,
    customerId,
    partnerId,
    categoryId,
    transactionDate: data.transactionDate,
  });
  return { duplicateWarning: duplicates.length > 0, duplicates: duplicates.map(serialize) };
}

function validateClassification(tx) {
  if (tx.transaction_type === TRANSACTION_TYPES.OUTTAKE) {
    if (!tx.expense_category_id) {
      throw new ValidationError('Outtake requires an expense category');
    }
    if (tx.source_type) {
      throw new ValidationError('Outtake must not have a source type');
    }
    return;
  }
  // intake
  if (tx.source_type === SOURCE_TYPES.CUSTOMER) {
    if (!tx.customer_id) throw new ValidationError('Customer intake requires a customer');
  } else if (tx.source_type === SOURCE_TYPES.PARTNER_CAPITAL || tx.source_type === SOURCE_TYPES.PARTNER_LOAN) {
    if (!tx.partner_id) throw new ValidationError('Partner inflow requires a partner');
  } else {
    throw new ValidationError('Intake requires a valid source type');
  }
}

export async function getAllTransactions(filters, { page, limit, offset }) {
  const { total, rows } = await listTransactions({ ...filters, page, limit, offset });
  return { total, rows: rows.map(serialize) };
}

export async function updateExistingTransaction(publicId, data, ctx) {
  const tx = await findTransactionByPublicId(publicId);
  if (!tx || tx.deleted_at) throw new NotFoundError('Transaction not found');
  if (tx.reversed_at) throw new ConflictError('Transaction is already reversed', 'ALREADY_REVERSED');
  if (tx.is_reversal) throw new ConflictError('Reversal records cannot be edited', 'IS_REVERSAL');
  assertFresh(tx, data?.versionTag ?? data?.expectedVersion);

  const refs = await resolveReferences({
    customerPublicId: data.customerPublicId,
    partnerPublicId: data.partnerPublicId,
    categoryPublicId: data.categoryPublicId,
  });

  const merged = {
    transaction_type: data.transactionType ?? tx.transaction_type,
    source_type: data.sourceType !== undefined ? data.sourceType : tx.source_type,
    customer_id: refs.customerId ?? tx.customer_id,
    partner_id: refs.partnerId ?? tx.partner_id,
    expense_category_id: refs.categoryId ?? tx.expense_category_id,
    amount: data.amount ?? tx.amount,
    payment_mode: data.paymentMode ?? tx.payment_mode,
    transaction_date: data.transactionDate ?? tx.transaction_date,
    reference_number: data.referenceNumber !== undefined ? data.referenceNumber : tx.reference_number,
    plot_number: data.plotNumber !== undefined ? data.plotNumber : tx.plot_number,
    paid_to: data.paidTo !== undefined ? data.paidTo : tx.paid_to,
    description: data.description !== undefined ? data.description : tx.description,
  };

  validateClassification(merged);

  const updated = await withTransactionJoinable(async () => {
    const row = await updateTransaction(tx.id, merged);

    await logAudit({
      userId: ctx.userId,
      action: AUDIT_ACTIONS.UPDATE,
      domain: 'transactions',
      recordId: tx.public_id,
      oldValues: { type: tx.transaction_type, source: tx.source_type, amount: tx.amount, date: tx.transaction_date },
      newValues: {
        type: row.transaction_type,
        source: row.source_type,
        amount: row.amount,
        date: row.transaction_date,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return row;
  });

  return serialize(updated);
}

export async function getTransaction(publicId) {
  const tx = await findTransactionByPublicId(publicId);
  if (!tx) throw new NotFoundError('Transaction not found');
  return serialize(tx);
}

export async function removeTransaction(publicId, { reason, versionTag, expectedVersion }, ctx) {
  const tx = await findTransactionByPublicId(publicId);
  if (!tx) throw new NotFoundError('Transaction not found');

  if (tx.reversed_at) {
    throw new ConflictError('Transaction is already reversed', 'ALREADY_REVERSED');
  }
  if (tx.is_reversal) {
    throw new ConflictError('Reversal records cannot be deleted', 'IS_REVERSAL');
  }
  // Optimistic concurrency: callers may pass the versionTag they read;
  // absent tags (direct path) proceed untouched.
  assertFresh(tx, versionTag ?? expectedVersion);

  const previousState = serialize(tx);

  await withTransactionJoinable(async () => {
    await softDeleteTransaction(tx.id);

    await logAudit({
      userId: ctx.userId,
      action: AUDIT_ACTIONS.DELETE,
      domain: 'transactions',
      recordId: tx.public_id,
      oldValues: { amount: tx.amount, type: tx.transaction_type, source: tx.source_type, date: tx.transaction_date },
      newValues: { amount: tx.amount, type: tx.transaction_type, reason },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  });

  return { success: true, previousState };
}

export async function reverseExistingTransaction(publicId, { reason, versionTag, expectedVersion }, ctx) {
  const tx = await findTransactionByPublicId(publicId);
  if (!tx) throw new NotFoundError('Transaction not found');
  if (tx.reversed_at) throw new ConflictError('Transaction is already reversed', 'ALREADY_REVERSED');
  if (tx.is_reversal) throw new ConflictError('Reversal records cannot be reversed', 'IS_REVERSAL');
  if (tx.deleted_at) throw new NotFoundError('Transaction not found');
  assertFresh(tx, versionTag ?? expectedVersion);

  const previousState = serialize(tx);

  const result = await withTransactionJoinable(async () => {
    const r = await modelReverseTransaction(tx.id, {
      userId: ctx.userId,
      reason,
    });
    if (r.error) {
      throw new ConflictError('Transaction could not be reversed', r.error);
    }

    await logAudit({
      userId: ctx.userId,
      action: AUDIT_ACTIONS.REVERSE,
      domain: 'transactions',
      recordId: tx.public_id,
      oldValues: { amount: tx.amount, type: tx.transaction_type, source: tx.source_type, date: tx.transaction_date },
      newValues: { amount: tx.amount, type: tx.transaction_type, reason },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return r;
  });

  return { success: true, reversalPublicId: result.reversalPublicId, previousState };
}

export async function getInternalTransaction(publicId) {
  return findTransactionByPublicId(publicId);
}