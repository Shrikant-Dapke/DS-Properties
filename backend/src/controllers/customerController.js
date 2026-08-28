import { submitChange } from '../services/governanceService.js';
import {
  listAllCustomers,
  getCustomer,
  getCustomerLedger,
} from '../services/customerService.js';
import { parsePage, parseLimit, offset, buildPagination } from '../utils/pagination.js';
import { buildContext } from './context.js';

export async function listCustomers(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await listAllCustomers({
    search: req.query.search,
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}

export async function getCustomerById(req, res) {
  const customer = await getCustomer(req.params.id);
  res.json({ success: true, data: customer });
}

export async function createCustomer(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'customer',
    entityId: null,
    operation: 'create',
    proposedState: req.body,
    ctx,
  });
  res.status(201).json({ success: true, data: result });
}

export async function updateCustomer(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'customer',
    entityId: req.params.id,
    operation: 'update',
    proposedState: req.body,
    ctx,
  });
  res.json({ success: true, data: result });
}

export async function deleteCustomer(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'customer',
    entityId: req.params.id,
    operation: 'delete',
    proposedState: {},
    ctx,
  });
  res.json({ success: true, data: result });
}

export async function customerLedger(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await getCustomerLedger(req.params.id, {
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}