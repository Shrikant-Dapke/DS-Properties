import { submitChange } from '../services/governanceService.js';
import { verifyUserPassword } from '../services/authService.js';
import { ValidationError } from '../utils/errors.js';
import {
  getTransaction,
  getAllTransactions,
} from '../services/transactionService.js';
import { parsePage, parseLimit, offset, buildPagination } from '../utils/pagination.js';
import { buildContext } from './context.js';

export async function createTransaction(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'transaction',
    entityId: null,
    operation: 'create',
    proposedState: req.body,
    ctx,
  });
  res.status(201).json({ success: true, data: result });
}

export async function listTransactions(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await getAllTransactions(
    {
      type: req.query.type,
      sourceType: req.query.sourceType,
      customerId: req.query.customerId,
      partnerId: req.query.partnerId,
      categoryId: req.query.categoryId,
      from: req.query.from,
      to: req.query.to,
      search: req.query.search,
    },
    { page, limit, offset: offset(page, limit) },
  );
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}

export async function getTransactionById(req, res) {
  const tx = await getTransaction(req.params.id);
  res.json({ success: true, data: tx });
}

export async function updateTransaction(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'transaction',
    entityId: req.params.id,
    operation: 'update',
    proposedState: req.body,
    ctx,
  });
  res.json({ success: true, data: result });
}

export async function deleteTransaction(req, res) {
  const ctx = buildContext(req);
  const { adminPassword, reason, versionTag, expectedVersion } = req.body ?? {};
  if (!adminPassword) {
    throw new ValidationError('Password confirmation is required', [
      { field: 'adminPassword', message: '"adminPassword" is required' },
    ]);
  }
  // Destructive-action re-authentication: re-verify the requesting partner's
  // OWN password directly (never via change-requests). Throws 401 when wrong.
  // The field keeps its historical name; it always carries the requester's
  // own password and is stripped before governance persistence/audit.
  await verifyUserPassword(ctx.userId, adminPassword);
  const result = await submitChange({
    entityType: 'transaction',
    entityId: req.params.id,
    operation: 'delete',
    // Never persist the password: only the reason (+ optional concurrency
    // tag) flows to governance/audit.
    proposedState: { reason, versionTag, expectedVersion },
    ctx,
  });
  res.json({ success: true, data: result });
}

export async function reverseTransaction(req, res) {
  const ctx = buildContext(req);
  const { adminPassword, reason, versionTag, expectedVersion } = req.body ?? {};
  if (!adminPassword) {
    throw new ValidationError('Password confirmation is required', [
      { field: 'adminPassword', message: '"adminPassword" is required' },
    ]);
  }
  await verifyUserPassword(ctx.userId, adminPassword);
  const result = await submitChange({
    entityType: 'transaction',
    entityId: req.params.id,
    operation: 'reverse',
    // Never persist the password: only the reason (+ optional concurrency
    // tag) flows to governance/audit.
    proposedState: { reason, versionTag, expectedVersion },
    ctx,
  });
  res.json({ success: true, data: result });
}