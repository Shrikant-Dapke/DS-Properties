import AuditLog from '../models/AuditLog.js';

export async function writeAudit(entry) {
  return AuditLog.create({
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    changeRequestId: entry.changeRequestId || null,
    entityType: entry.entityType,
    entityId: entry.entityId,
    operation: entry.operation,
    field: entry.field || null,
    oldValue: entry.oldValue !== undefined ? entry.oldValue : null,
    newValue: entry.newValue !== undefined ? entry.newValue : null,
    note: entry.note || null,
  });
}
