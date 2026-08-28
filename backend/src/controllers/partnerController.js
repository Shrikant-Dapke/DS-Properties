import { submitChange } from '../services/governanceService.js';
import {
  listAllPartners,
  getPartner,
  getPartnerLedger,
} from '../services/partnerService.js';
import { parsePage, parseLimit, offset, buildPagination } from '../utils/pagination.js';
import { buildContext } from './context.js';

export async function listPartners(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await listAllPartners({
    search: req.query.search,
    activeOnly: req.query.activeOnly,
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}

export async function getPartnerById(req, res) {
  const partner = await getPartner(req.params.id);
  res.json({ success: true, data: partner });
}

export async function createPartner(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'partner',
    entityId: null,
    operation: 'create',
    proposedState: req.body,
    ctx,
  });
  res.status(201).json({ success: true, data: result });
}

export async function updatePartner(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'partner',
    entityId: req.params.id,
    operation: 'update',
    proposedState: req.body,
    ctx,
  });
  res.json({ success: true, data: result });
}

export async function deletePartner(req, res) {
  const ctx = buildContext(req);
  const result = await submitChange({
    entityType: 'partner',
    entityId: req.params.id,
    operation: 'delete',
    proposedState: {},
    ctx,
  });
  res.json({ success: true, data: result });
}

export async function partnerLedger(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await getPartnerLedger(req.params.id, {
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}