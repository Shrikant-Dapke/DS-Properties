import request from 'supertest';
import app from '../../src/app.js';
import { api, getAdminToken, authHeader, login } from '../helpers/api.js';

describe('Auth', () => {
  describe('POST /auth/login', () => {
    it('logs in with valid credentials and returns access + refresh tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'Admin@123' });
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
      const data = await login('admin', 'Admin@123');
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: data.refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).not.toBe(data.refreshToken);
    });

    it('rejects an already-used (revoked) refresh token', async () => {
      const data = await login('admin', 'Admin@123');
      await request(app).post('/api/v1/auth/refresh').send({ refreshToken: data.refreshToken });
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: data.refreshToken });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token', async () => {
      const data = await login('admin', 'Admin@123');
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
        .send({ currentPassword: 'Admin@123', newPassword: 'NewPass@456' });
      expect(res.status).toBe(200);

      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'Admin@123' });
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
        .send({ currentPassword: 'NewPass@456', newPassword: 'Admin@123' });
      expect(restore.status).toBe(200);
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
  const res = await request(app)
    .post('/api/v1/users')
    .set(authHeader(adminToken))
    .send({ username, password: 'Test@1234', fullName: 'Lock Test', role: 'operator' });
  return { username, password: 'Test@1234' };
}