import { query } from '../config/database.js';

export function insertAuditLog({ userId, action, domain, recordId, oldValues, newValues, ip, userAgent }) {
  return query(
    `INSERT INTO audit_logs (user_id, action, domain, record_id, old_values, new_values, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId ?? null,
      action,
      domain,
      recordId ?? null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ip ?? null,
      userAgent ?? null,
    ],
  ).then((r) => r.rowCount);
}

export function listAuditLogs({ domain, action, userId, from, to, limit, offset }) {
  const where = ['1 = 1'];
  const values = [];
  let idx = 1;

  if (domain) {
    values.push(domain);
    where.push(`domain = $${idx}`);
    idx += 1;
  }
  if (action) {
    values.push(action);
    where.push(`action = $${idx}`);
    idx += 1;
  }
  if (userId) {
    values.push(userId);
    where.push(`user_id = $${idx}`);
    idx += 1;
  }
  if (from) {
    values.push(from);
    where.push(`created_at >= $${idx}`);
    idx += 1;
  }
  if (to) {
    values.push(to);
    where.push(`created_at <= $${idx}`);
    idx += 1;
  }

  const whereSql = where.join(' AND ');
  const countP = query(`SELECT count(*)::int AS total FROM audit_logs WHERE ${whereSql}`, values);
  const listP = query(
    `SELECT a.*, u.username AS user_username, u.public_id AS user_public_id
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE ${whereSql}
     ORDER BY a.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}