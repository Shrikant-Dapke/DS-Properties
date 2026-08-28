import { submitChange } from '../services/governanceService.js';
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
  const result = await submitChange({
    entityType: 'transaction',
    entityId: req.params.id,
    operation: 'delete',
    proposedState: req.body,
    ctx,
  });
  res.json({ success: true, data: result });
}

export async function reverseTransaction(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'transaction',
    entityId: req.params.id,
    operation: 'reverse',
    proposedState: req.body,
    ctx,
  });
  res.json({ success: true, data: result });
}