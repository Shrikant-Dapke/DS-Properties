import { query } from '../config/database.js';

const COLUMNS = 'id, public_id, name, phone, email, address, notes, created_at, updated_at, deleted_at';

export function listCustomers({ search, limit, offset }) {
  const where = ['c.deleted_at IS NULL'];
  const values = [];
  let idx = 1;

  if (search) {
    values.push(`%${search}%`);
    where.push(`(c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.email ILIKE $${idx})`);
    idx += 1;
  }

  const whereSql = where.join(' AND ');
  const countP = query(`SELECT count(*)::int AS total FROM customers c WHERE ${whereSql}`, values);
  const listP = query(
    `SELECT c.id, c.public_id, c.name, c.phone, c.email, c.address, c.notes,
            c.created_at, c.updated_at,
            COALESCE(SUM(t.amount) FILTER (WHERE t.deleted_at IS NULL AND t.reversed_at IS NULL AND t.is_reversal = false), 0)::numeric(14,2) AS total_paid
     FROM customers c
     LEFT JOIN transactions t ON t.customer_id = c.id AND t.transaction_type = 'intake'
     WHERE ${whereSql}
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}

export function findCustomerById(id) {
  return query(
    `SELECT c.id, c.public_id, c.name, c.phone, c.email, c.address, c.notes,
            c.created_at, c.updated_at,
            COALESCE(SUM(t.amount) FILTER (WHERE t.deleted_at IS NULL AND t.reversed_at IS NULL AND t.is_reversal = false), 0)::numeric(14,2) AS total_paid
     FROM customers c
     LEFT JOIN transactions t ON t.customer_id = c.id AND t.transaction_type = 'intake'
     WHERE c.id = $1
     GROUP BY c.id`,
    [id],
  ).then((r) => r.rows[0] || null);
}

export function findCustomerByPublicId(publicId) {
  return query(
    `SELECT id FROM customers WHERE public_id = $1 AND deleted_at IS NULL`,
    [publicId],
  ).then((r) => r.rows[0] || null);
}

export function createCustomer({ name, phone, email, address, notes }) {
  return query(
    `INSERT INTO customers (name, phone, email, address, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, public_id, name, phone, email, address, notes, created_at, updated_at`,
    [name, phone ?? null, email ?? null, address ?? null, notes ?? null],
  ).then((r) => r.rows[0]);
}

export function updateCustomer(id, fields) {
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
    `UPDATE customers SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING ${COLUMNS}`,
    values,
  ).then((r) => r.rows[0] || null);
}

export function softDeleteCustomer(id) {
  return query(
    `UPDATE customers SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLUMNS}`,
    [id],
  ).then((r) => r.rows[0] || null);
}

export function countCustomerTransactions(customerId) {
  return query(
    `SELECT count(*)::int AS total FROM transactions WHERE customer_id = $1 AND deleted_at IS NULL`,
    [customerId],
  ).then((r) => r.rows[0].total);
}