import { query } from '../config/database.js';

const COLUMNS =
  'id, public_id, name, slug, description, is_active, sort_order, created_at, updated_at, deleted_at';

export function listCategories({ activeOnly, limit, offset }) {
  const where = ['deleted_at IS NULL'];
  const values = [];
  let idx = 1;
  if (activeOnly) {
    values.push(true);
    where.push(`is_active = $${idx}`);
    idx += 1;
  }
  const whereSql = where.join(' AND ');
  const countP = query(`SELECT count(*)::int AS total FROM expense_categories WHERE ${whereSql}`, values);
  const listP = query(
    `SELECT ${COLUMNS} FROM expense_categories
     WHERE ${whereSql}
     ORDER BY sort_order ASC, name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );
  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}

export function findAllActiveCategories() {
  return query(
    `SELECT ${COLUMNS} FROM expense_categories WHERE is_active = true AND deleted_at IS NULL ORDER BY sort_order ASC`,
  ).then((r) => r.rows);
}

export function findCategoryById(id) {
  return query(`SELECT ${COLUMNS} FROM expense_categories WHERE id = $1`, [id]).then(
    (r) => r.rows[0] || null,
  );
}

export function findCategoryByPublicId(publicId) {
  return query(
    `SELECT id FROM expense_categories WHERE public_id = $1 AND deleted_at IS NULL`,
    [publicId],
  ).then((r) => r.rows[0] || null);
}

export function createCategory({ name, slug, description, sortOrder }) {
  return query(
    `INSERT INTO expense_categories (name, slug, description, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNS}`,
    [name, slug, description ?? null, sortOrder ?? 0],
  ).then((r) => r.rows[0]);
}

export function updateCategory(id, fields) {
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
    `UPDATE expense_categories SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${COLUMNS}`,
    values,
  ).then((r) => r.rows[0] || null);
}

export function softDeleteCategory(id) {
  return query(
    `UPDATE expense_categories SET deleted_at = now(), is_active = false WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLUMNS}`,
    [id],
  ).then((r) => r.rows[0] || null);
}

export function countCategoryTransactions(categoryId) {
  return query(
    `SELECT count(*)::int AS total FROM transactions WHERE expense_category_id = $1 AND deleted_at IS NULL`,
    [categoryId],
  ).then((r) => r.rows[0].total);
}