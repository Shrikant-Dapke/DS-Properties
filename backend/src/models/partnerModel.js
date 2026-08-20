import { query } from '../config/database.js';

const COLUMNS = 'id, public_id, name, phone, email, address, notes, is_active, created_at, updated_at, deleted_at';

export function listPartners({ search, activeOnly, limit, offset }) {
  const where = ['p.deleted_at IS NULL'];
  const values = [];
  let idx = 1;

  if (search) {
    values.push(`%${search}%`);
    where.push(`(p.name ILIKE $${idx} OR p.phone ILIKE $${idx} OR p.email ILIKE $${idx})`);
    idx += 1;
  }
  if (activeOnly) {
    values.push(true);
    where.push(`p.is_active = $${idx}`);
    idx += 1;
  }

  const whereSql = where.join(' AND ');
  const countP = query(`SELECT count(*)::int AS total FROM partners p WHERE ${whereSql}`, values);
  const listP = query(
    `SELECT p.id, p.public_id, p.name, p.phone, p.email, p.address, p.notes, p.is_active,
            p.created_at, p.updated_at,
            COALESCE(SUM(t.amount) FILTER (WHERE t.deleted_at IS NULL AND t.reversed_at IS NULL AND t.is_reversal = false), 0)::numeric(14,2) AS total_inflow
     FROM partners p
     LEFT JOIN transactions t ON t.partner_id = p.id
     WHERE ${whereSql}
     GROUP BY p.id
     ORDER BY p.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}

export function findPartnerById(id) {
  return query(`SELECT ${COLUMNS} FROM partners WHERE id = $1`, [id]).then(
    (r) => r.rows[0] || null,
  );
}

export function findPartnerByPublicId(publicId) {
  return query(
    `SELECT id, is_active FROM partners WHERE public_id = $1 AND deleted_at IS NULL`,
    [publicId],
  ).then((r) => r.rows[0] || null);
}

export function createPartner({ name, phone, email, address, notes }) {
  return query(
    `INSERT INTO partners (name, phone, email, address, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNS}`,
    [name, phone ?? null, email ?? null, address ?? null, notes ?? null],
  ).then((r) => r.rows[0]);
}

export function updatePartner(id, fields) {
  const sets = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = $${idx}`);
    values.push(value);
    idx += 1;
  }
  values.push(id);
  return query(
    `UPDATE partners SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${COLUMNS}`,
    values,
  ).then((r) => r.rows[0] || null);
}

export function softDeletePartner(id) {
  return query(
    `UPDATE partners SET deleted_at = now(), is_active = false WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLUMNS}`,
    [id],
  ).then((r) => r.rows[0] || null);
}

export function countPartnerTransactions(partnerId) {
  return query(
    `SELECT count(*)::int AS total FROM transactions WHERE partner_id = $1 AND deleted_at IS NULL`,
    [partnerId],
  ).then((r) => r.rows[0].total);
}