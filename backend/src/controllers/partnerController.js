import {
  listAllPartners,
  getPartner,
  createNewPartner,
  updateExistingPartner,
  deletePartner as deletePartnerService,
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
  const partner = await createNewPartner(req.body, ctx);
  res.status(201).json({ success: true, data: partner });
}

export async function updatePartner(req, res) {
  const ctx = buildContext(req);
  const partner = await updateExistingPartner(req.params.id, req.body, ctx);
  res.json({ success: true, data: partner });
}

export async function deletePartner(req, res) {
  const ctx = buildContext(req);
  const result = await deletePartnerService(req.params.id, ctx);
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