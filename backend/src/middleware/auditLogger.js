import { logAudit } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

/**
 * Route-level audit middleware. After the handler completes successfully,
 * it writes an audit record using `res.locals.audit` (recordId, oldValues,
 * newValues, action override) or a sensible default derived from the request.
 */
export function withAudit(domain, action) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const override = res.locals.audit;
      const recordId = override?.recordId ?? req.params?.id;
      logAudit({
        userId: req.user?.id ?? null,
        action: override?.action ?? action,
        domain,
        recordId,
        oldValues: override?.oldValues,
        newValues: override?.newValues,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }).catch((err) => {
        logger.error({ err }, 'Audit log write failed');
      });
    });
    next();
  };
}