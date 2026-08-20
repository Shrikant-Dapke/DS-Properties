import {
  listAllUsers,
  createNewUser,
  updateExistingUser,
  setUserActive,
  resetUserPassword,
  deleteUser,
} from '../services/userService.js';
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
  const user = await createNewUser(req.body, ctx);
  res.status(201).json({ success: true, data: user });
}

export async function updateUser(req, res) {
  const ctx = buildContext(req);
  const user = await updateExistingUser(req.params.id, req.body, ctx);
  res.json({ success: true, data: user });
}

export async function setActive(req, res) {
  const ctx = buildContext(req);
  const user = await setUserActive(req.params.id, req.body.isActive, ctx);
  res.json({ success: true, data: user });
}

export async function resetPassword(req, res) {
  const ctx = buildContext(req);
  const result = await resetUserPassword(req.params.id, req.body.newPassword, ctx);
  res.json({ success: true, data: result });
}

export async function removeUser(req, res) {
  const ctx = buildContext(req);
  const result = await deleteUser(req.params.id, ctx);
  res.json({ success: true, data: result });
}