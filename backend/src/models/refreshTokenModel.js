import { query } from '../config/database.js';
import { createHash } from 'node:crypto';

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function storeRefreshToken({ userId, tokenHash, expiresAt, ip, userAgent, familyId }) {
  if (familyId) {
    return query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, family_id`,
      [userId, tokenHash, familyId, expiresAt, ip, userAgent],
    ).then((r) => r.rows[0]);
  }
  return query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, family_id`,
    [userId, tokenHash, expiresAt, ip, userAgent],
  ).then((r) => r.rows[0]);
}

export function findRefreshTokenByHash(tokenHash) {
  return query(
    `SELECT rt.*, u.is_active AS user_is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash],
  ).then((r) => r.rows[0] || null);
}

export function findRefreshTokenByHashForUpdate(tokenHash) {
  return query(
    `SELECT rt.*, u.is_active AS user_is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
     FOR UPDATE OF rt`,
    [tokenHash],
  ).then((r) => r.rows[0] || null);
}

export function revokeRefreshToken(id) {
  return query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [id]).then(
    (r) => r.rowCount,
  );
}

export function revokeUserRefreshTokens(userId) {
  return query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  ).then((r) => r.rowCount);
}

export function revokeTokenFamily(familyId, exceptId) {
  if (exceptId === undefined || exceptId === null) {
    return query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    ).then((r) => r.rowCount);
  }
  return query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE family_id = $1 AND id <> $2 AND revoked_at IS NULL`,
    [familyId, exceptId],
  ).then((r) => r.rowCount);
}

export function linkRefreshTokenChain(oldId, newId) {
  return query(`UPDATE refresh_tokens SET replaced_by_id = $2 WHERE id = $1`, [oldId, newId]).then(
    (r) => r.rowCount,
  );
}

export function cleanupExpiredTokens() {
  return query(`DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days'`).then(
    (r) => r.rowCount,
  );
}