import {
  listChangeRequestsForApi,
  approveChange,
  rejectChange,
  cancelChange,
} from '../services/governanceService.js';
import { getChangeRequestByPublicId } from '../models/changeRequestModel.js';
import { parsePage, parseLimit, offset, buildPagination } from '../utils/pagination.js';
import { buildContext } from './context.js';
import { validateDecision, validateCancel } from '../validators/governanceValidators.js';
import { NotFoundError } from '../utils/errors.js';

export async function listChangeRequests(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await listChangeRequestsForApi({
    status: req.query.status,
    entityType: req.query.entityType,
    requestedBy: req.query.requestedBy ? Number(req.query.requestedBy) : undefined,
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}

export async function getChangeRequest(req, res) {
  const request = await getChangeRequestByPublicId(req.params.id);
  if (!request) throw new NotFoundError('Change request not found');
  res.json({ success: true, data: request });
}

export async function approveChangeHandler(req, res) {
  const ctx = buildContext(req);
  const { comment } = validateDecision(req.body);
  const result = await approveChange(req.params.id, req.user, comment, ctx);
  res.json({ success: true, data: result });
}

export async function rejectChangeHandler(req, res) {
  const ctx = buildContext(req);
  const { comment } = validateDecision(req.body);
  const result = await rejectChange(req.params.id, req.user, comment, ctx);
  res.json({ success: true, data: result });
}

export async function cancelChangeHandler(req, res) {
  const ctx = buildContext(req);
  const { reason, comment } = validateCancel(req.body);
  const cancelReason = (typeof reason === 'string' && reason.trim())
    ? reason.trim()
    : (typeof comment === 'string' && comment.trim() ? comment.trim() : null);
  const result = await cancelChange(req.params.id, req.user, cancelReason, ctx);
  res.json({ success: true, data: result });
}
