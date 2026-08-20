import { query } from '../config/database.js';

export function getSetting(key) {
  return query(`SELECT key, value, description, updated_at FROM app_settings WHERE key = $1`, [
    key,
  ]).then((r) => r.rows[0] || null);
}

export function getAllSettings() {
  return query(
    `SELECT s.key, s.value, s.description, s.updated_at, u.username AS updated_by_username
     FROM app_settings s
     LEFT JOIN users u ON u.id = s.updated_by
     ORDER BY s.key ASC`,
  ).then((r) => r.rows);
}

export function upsertSetting(key, value, description, updatedBy) {
  return query(
    `INSERT INTO app_settings (key, value, description, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           description = COALESCE(EXCLUDED.description, app_settings.description),
           updated_by = EXCLUDED.updated_by
     RETURNING key, value, description, updated_at`,
    [key, JSON.stringify(value), description ?? null, updatedBy ?? null],
  ).then((r) => r.rows[0]);
}

export async function getOpeningBalance() {
  const row = await getSetting('opening_balance');
  if (!row) return 0;
  return Number.parseFloat(row.value) || 0;
}