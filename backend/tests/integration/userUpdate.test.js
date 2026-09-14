import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import { getAdminToken, authHeader, setupPartner } from '../helpers/api.js';

function uniq(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

describe('User update incl. username edit (PUT /users/:id)', () => {
  let adminToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  async function usernameInDb(publicId) {
    const r = await pool.query('SELECT username FROM users WHERE public_id = $1', [publicId]);
    return r.rows[0]?.username;
  }

  it('persists a changed username and shows it on reload', async () => {
    const p = await setupPartner(adminToken, 'uname');
    const next = `${p.username}2`;

    const res = await request(app)
      .put(`/api/v1/users/${p.userPublicId}`)
      .set(authHeader(adminToken))
      .send({ username: next });
    expect(res.status).toBe(200);
    expect(res.body.data.entity.username).toBe(next);

    // Persists after reload (fresh read, not response echo).
    expect(await usernameInDb(p.userPublicId)).toBe(next);
    const list = await request(app)
      .get('/api/v1/users')
      .query({ search: next })
      .set(authHeader(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.data.rows.map((r) => r.username)).toContain(next);

    // The new username is functional for login.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: next, password: p.password });
    expect(login.status).toBe(200);
  });

  it('rejects a duplicate username and leaves the original untouched', async () => {
    const a = await setupPartner(adminToken, 'dupea');
    const b = await setupPartner(adminToken, 'dupeb');

    const res = await request(app)
      .put(`/api/v1/users/${b.userPublicId}`)
      .set(authHeader(adminToken))
      .send({ username: a.username });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
    expect(await usernameInDb(b.userPublicId)).toBe(b.username);
  });

  it('rejects invalid usernames (too short / illegal characters)', async () => {
    const p = await setupPartner(adminToken, 'baduname');
    for (const bad of ['ab', 'has space', 'bang!']) {
      const res = await request(app)
        .put(`/api/v1/users/${p.userPublicId}`)
        .set(authHeader(adminToken))
        .send({ username: bad });
      expect(res.status).toBe(400);
    }
    expect(await usernameInDb(p.userPublicId)).toBe(p.username);
  });

  it('preserves existing update behavior (full name edit still works)', async () => {
    const p = await setupPartner(adminToken, 'fullname');
    const res = await request(app)
      .put(`/api/v1/users/${p.userPublicId}`)
      .set(authHeader(adminToken))
      .send({ fullName: 'Renamed Person' });
    expect(res.status).toBe(200);
    expect(res.body.data.entity.fullName).toBe('Renamed Person');
    expect(res.body.data.entity.username).toBe(p.username);
  });
});
