import { query } from '../config/database.js';

const SELECT_COLUMNS = `
  id, public_id, username, password_hash, full_name, email, phone, role,
  is_active, failed_login_attempts, locked_until, last_login_at,
  created_at, updated_at, deleted_at
`;

export function findUserByUsername(username) {
  return query(
    `SELECT ${SELECT_COLUMNS}, password_hash
     FROM users WHERE username = $1 AND deleted_at IS NULL`,
    [username],
  ).then((r) => r.rows[0] || null);
}

export function findUserById(id) {
  return query(
    `SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`,
    [id],
  ).then((r) => r.rows[0] || null);
}

export function findUserByPublicId(publicId) {
  return query(
    `SELECT ${SELECT_COLUMNS} FROM users WHERE public_id = $1 AND deleted_at IS NULL`,
    [publicId],
  ).then((r) => r.rows[0] || null);
}

export function createUser({ username, passwordHash, fullName, email, phone, role }) {
  return query(
    `INSERT INTO users (username, password_hash, full_name, email, phone, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SELECT_COLUMNS}`,
    [username, passwordHash, fullName, email, phone, role],
  ).then((r) => r.rows[0]);
}

export function updateUser(id, fields) {
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
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING ${SELECT_COLUMNS}`,
    values,
  ).then((r) => r.rows[0] || null);
}

export function listUsers({ search, role, limit, offset }) {
  const where = ['deleted_at IS NULL'];
  const values = [];
  let idx = 1;

  if (search) {
    values.push(`%${search}%`);
    where.push(`(username ILIKE $${idx} OR full_name ILIKE $${idx} OR email ILIKE $${idx})`);
    idx += 1;
  }
  if (role) {
    values.push(role);
    where.push(`role = $${idx}`);
    idx += 1;
  }

  const whereSql = where.join(' AND ');
  const countP = query(`SELECT count(*)::int AS total FROM users WHERE ${whereSql}`, values);
  const listP = query(
    `SELECT ${SELECT_COLUMNS} FROM users
     WHERE ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}

export function recordLoginFailure(id) {
  return query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1
     WHERE id = $1
     RETURNING failed_login_attempts, locked_until`,
    [id],
  ).then((r) => r.rows[0] || null);
}

export function lockAccount(id, lockedUntil) {
  return query(`UPDATE users SET locked_until = $2 WHERE id = $1`, [id, lockedUntil]).then(
    (r) => r.rowCount,
  );
}

export function clearLoginFailures(id) {
  return query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
    [id],
  ).then((r) => r.rowCount);
}

export function touchLastLogin(id) {
  return query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [id]).then((r) => r.rowCount);
}

export function updatePasswordHash(id, passwordHash) {
  return query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, passwordHash]).then(
    (r) => r.rowCount,
  );
}

export function softDeleteUser(id) {
  return query(
    `UPDATE users SET deleted_at = now(), is_active = false WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
    [id],
  ).then((r) => r.rows[0] || null);
}