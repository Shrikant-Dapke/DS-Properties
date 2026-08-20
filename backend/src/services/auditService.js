import { insertAuditLog, listAuditLogs } from '../models/auditModel.js';
import { logger } from '../utils/logger.js';

export function logAudit({ userId, action, domain, recordId, oldValues, newValues, ip, userAgent }) {
  return insertAuditLog({
    userId,
    action,
    domain,
    recordId: recordId != null ? String(recordId) : null,
    oldValues,
    newValues,
    ip,
    userAgent,
  }).catch((err) => {
    // Audit must never silently corrupt the primary operation, but it also
    // must not be ignored. Log loudly and rethrow only in tests.
    logger.error({ err, action, domain }, 'Failed to write audit log');
    throw err;
  });
}

export async function getAuditLogs({ domain, action, userId, from, to, page, limit, offset }) {
  const { total, rows } = await listAuditLogs({
    domain,
    action,
    userId,
    from,
    to,
    page,
    limit,
    offset,
  });
  return { total, rows };
}