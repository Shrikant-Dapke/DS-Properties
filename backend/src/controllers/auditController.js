import { getAuditLogs } from '../services/auditService.js';
import { parsePage, parseLimit, offset, buildPagination } from '../utils/pagination.js';

export async function listAuditLogs(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await getAuditLogs({
    domain: req.query.domain,
    action: req.query.action,
    userId: req.query.userId,
    from: req.query.from,
    to: req.query.to,
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}