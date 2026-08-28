import {
  listAllUsers,
} from '../services/userService.js';
import { submitChange } from '../services/governanceService.js';
import { parsePage, parseLimit, offset, buildPagination } from '../utils/pagination.js';
import { buildContext } from './context.js';

export async function listUsers(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await listAllUsers({
    search: req.query.search,
    role: req.query.role,
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}

export async function createUser(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'user',
    entityId: null,
    operation: 'create',
    proposedState: req.body,
    ctx,
  });
  return res.status(201).json({ success: true, data: result });
}

export async function updateUser(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'user',
    entityId: req.params.id,
    operation: 'update',
    proposedState: req.body,
    ctx,
  });
  return res.json({ success: true, data: result });
}

export async function setActive(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'user',
    entityId: req.params.id,
    operation: 'update',
    proposedState: { isActive: req.body.isActive },
    ctx,
  });
  return res.json({ success: true, data: result });
}

export async function resetPassword(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'user',
    entityId: req.params.id,
    operation: 'update',
    proposedState: { password: req.body.newPassword },
    ctx,
  });
  return res.json({ success: true, data: result });
}

export async function removeUser(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'user',
    entityId: req.params.id,
    operation: 'delete',
    proposedState: {},
    ctx,
  });
  return res.json({ success: true, data: result });
}