import request from 'supertest';
import app from '../../src/app.js';
import { api, getAdminToken, authHeader, login } from '../helpers/api.js';
import { TEST_ADMIN_PASSWORD } from '../helpers/testCredentials.js';
import { pool } from '../setup.js';
import { parseExpiry, getRefreshTokenTtlMs } from '../../src/services/authService.js';
import { hashToken } from '../../src/models/refreshTokenModel.js';
import { config } from '../../src/config/environment.js';

async function rowByToken(plain) {
  const { rows } = await pool.query(
    'SELECT id, family_id, revoked_at, replaced_by_id, expires_at FROM refresh_tokens WHERE token_hash = $1',
    [hashToken(plain)],
  );
  return rows[0] || null;
}

describe('Auth', () => {
  describe('POST /auth/login', () => {
    it('logs in with valid credentials and returns access + refresh tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: TEST_ADMIN_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();
      expect(res.body.data.user.role).toBe('admin');
    });

    it('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'WrongPass1' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('issues access tokens that expire after 15 minutes', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: TEST_ADMIN_PASSWORD });
      const payload = JSON.parse(Buffer.from(res.body.data.accessToken.split('.')[1], 'base64url').toString());
      const ttlSeconds = payload.exp - payload.iat;
      expect(ttlSeconds).toBe(900);
    });

    it('rejects short password at validation layer', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('locks the account after 5 consecutive failed attempts (423)', async () => {
      const { username } = await createThrowawayOperator();
      for (let i = 0; i < 5; i += 1) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ username, password: 'WrongPass1' });
        expect([401, 423]).toContain(res.status);
      }
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username, password: 'WrongPass1' });
      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('audits successful and failed logins', async () => {
      const adminToken = await getAdminToken();
      const res = await request(app)
        .get('/api/v1/audit')
        .set(authHeader(adminToken))
        .query({ domain: 'auth', action: 'login' });
      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBeGreaterThan(0);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token', async () => {
      const data = await login('admin', TEST_ADMIN_PASSWORD);
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: data.refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).not.toBe(data.refreshToken);
    });

    it('rejects an already-used (revoked) refresh token', async () => {
      const data = await login('admin', TEST_ADMIN_PASSWORD);
      await request(app).post('/api/v1/auth/refresh').send({ refreshToken: data.refreshToken });
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: data.refreshToken });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token', async () => {
      const data = await login('admin', TEST_ADMIN_PASSWORD);
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: data.refreshToken });
      expect(res.status).toBe(200);
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: data.refreshToken });
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('POST /auth/change-password', () => {
    it('changes password and revokes refresh tokens', async () => {
      const adminToken = await getAdminToken();
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set(authHeader(adminToken))
        .send({ currentPassword: TEST_ADMIN_PASSWORD, newPassword: 'NewPass@456' });
      expect(res.status).toBe(200);

      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: TEST_ADMIN_PASSWORD });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'NewPass@456' });
      expect(newLogin.status).toBe(200);

      // Restore the seeded password so later test files can still log in as admin.
      const freshAdminToken = newLogin.body.data.accessToken;
      const restore = await request(app)
        .post('/api/v1/auth/change-password')
        .set(authHeader(freshAdminToken))
        .send({ currentPassword: 'NewPass@456', newPassword: TEST_ADMIN_PASSWORD });
      expect(restore.status).toBe(200);
    });
  });

  describe('P0 refresh rotation security', () => {
    it('preserves family_id, links old.replaced_by = new, and reuse 401s with successor revoked', async () => {
      const data = await login('admin', TEST_ADMIN_PASSWORD);
      const before = await rowByToken(data.refreshToken);
      expect(before).toBeTruthy();
      expect(before.family_id).toBeTruthy();

      const first = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: data.refreshToken });
      expect(first.status).toBe(200);
      const successor = first.body.data.refreshToken;
      expect(successor).toBeTruthy();
      expect(successor).not.toBe(data.refreshToken);

      const oldRow = await rowByToken(data.refreshToken);
      const newRow = await rowByToken(successor);
      expect(newRow).toBeTruthy();
      // Same family is preserved across rotation.
      expect(String(newRow.family_id)).toBe(String(before.family_id));
      // Old token is revoked and points forward to its successor.
      expect(oldRow.revoked_at).not.toBeNull();
      expect(String(oldRow.replaced_by_id)).toBe(String(newRow.id));
      // Successor must not point backwards.
      expect(newRow.replaced_by_id).toBeNull();

      // Reuse of the rotated (now revoked) token must 401 and revoke the family.
      const reuse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: data.refreshToken });
      expect(reuse.status).toBe(401);

      const oldAfterReuse = await rowByToken(data.refreshToken);
      const newAfterReuse = await rowByToken(successor);
      expect(oldAfterReuse.revoked_at).not.toBeNull();
      // Complete family revoked including the trigger and its successor.
      expect(newAfterReuse.revoked_at).not.toBeNull();

      // The successor is now unusable as well.
      const successorRetry = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: successor });
      expect(successorRetry.status).toBe(401);
    });

    it('concurrent refresh of the same token: one wins, no multiple valid successors', async () => {
      const data = await login('admin', TEST_ADMIN_PASSWORD);
      const [a, b] = await Promise.all([
        request(app).post('/api/v1/auth/refresh').send({ refreshToken: data.refreshToken }),
        request(app).post('/api/v1/auth/refresh').send({ refreshToken: data.refreshToken }),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 401]);

      const winner = a.status === 200 ? a : b;
      expect(winner.body.data.refreshToken).toBeTruthy();

      // Exactly one successor row was created for this family (original + 1),
      // never two valid successors from the same-token race.
      const { rows } = await pool.query(
        'SELECT id, revoked_at FROM refresh_tokens WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)',
        [hashToken(data.refreshToken)],
      );
      expect(rows.length).toBe(2);
      // Reuse detection revokes the complete family, so no valid token remains.
      expect(rows.filter((r) => !r.revoked_at).length).toBe(0);

      // The winner's token was revoked by the loser's family revocation.
      const winnerRetry = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: winner.body.data.refreshToken });
      expect(winnerRetry.status).toBe(401);
    });
  });

  describe('P0 refresh TTL parsing', () => {
    it('parses s/m/h/d/w and ms; "7d" equals 7 days and default stays 7d', async () => {
      const day = 24 * 3600;
      expect(parseExpiry('7d', day)).toBe(7 * day);
      expect(parseExpiry('15m', 0)).toBe(900);
      expect(parseExpiry('15s', 0)).toBe(15);
      expect(parseExpiry('2h', 0)).toBe(7200);
      expect(parseExpiry('1w', 0)).toBe(604800);
      expect(parseExpiry('500ms', 0)).toBe(0.5);
      expect(parseExpiry('1000', 0)).toBe(1000);
      expect(parseExpiry(3600, 0)).toBe(3600);
      expect(parseExpiry(undefined, 604800)).toBe(604800);
      expect(parseExpiry(null, 604800)).toBe(604800);
      expect(parseExpiry('', 604800)).toBe(604800);
      expect(parseExpiry('not-a-ttl', 604800)).toBe(604800);
      // Service TTL stays consistent with configured expiry; default config is 7d.
      expect(getRefreshTokenTtlMs()).toBe(parseExpiry(config.jwt.refreshExpires, 7 * day) * 1000);
      if (config.jwt.refreshExpires === '7d') {
        expect(getRefreshTokenTtlMs()).toBe(7 * day * 1000);
      }
    });
  });

  describe('Authorization enforcement', () => {
    it('rejects requests without a token', async () => {
      const res = await api().get('/api/v1/customers');
      expect(res.status).toBe(401);
    });

    it('rejects invalid tokens', async () => {
      const res = await request(app)
        .get('/api/v1/customers')
        .set(authHeader('not.a.jwt'));
      expect(res.status).toBe(401);
    });
  });
});

async function createThrowawayOperator() {
  const adminToken = await getAdminToken();
  const username = `lock_${Date.now()}`;
  // Lockout mechanics are role-independent; use a partner user (needs a
  // linked record) so no retired role appears in the suite.
  const prec = await request(app)
    .post('/api/v1/partners')
    .set(authHeader(adminToken))
    .send({ name: `LockRec_${Date.now()}` });
  const res = await request(app)
    .post('/api/v1/users')
    .set(authHeader(adminToken))
    .send({
      username,
      password: 'Test@1234',
      fullName: 'Lock Test',
      role: 'partner',
      partnerPublicId: prec.body.data.entity.publicId,
    });
  if (res.status !== 201) throw new Error(`lockout fixture failed: ${JSON.stringify(res.body)}`);
  return { username, password: 'Test@1234' };
}