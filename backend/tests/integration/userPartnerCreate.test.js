import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import { getAdminToken, authHeader, setupPartner } from '../helpers/api.js';

function uniq(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

describe('Partner user creation with inline partner onboarding (POST /users newPartner)', () => {
  let adminToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  async function activePartnerCount() {
    const r = await pool.query('SELECT count(*)::int AS total FROM partners WHERE deleted_at IS NULL');
    return r.rows[0].total;
  }

  async function auditsFor(recordId) {
    const r = await pool.query(
      'SELECT action, domain FROM audit_logs WHERE record_id = $1 ORDER BY id',
      [recordId],
    );
    return r.rows;
  }

  async function createPartnerRecord(name) {
    const res = await request(app)
      .post('/api/v1/partners')
      .set(authHeader(adminToken))
      .send({ name });
    expect(res.status).toBe(201);
    return res.body.data.entity;
  }

  it('links a partner user to an existing partner without creating a partner row', async () => {
    const before = await activePartnerCount();
    const partner = await createPartnerRecord(uniq('LinkExist'));
    const mid = await activePartnerCount();
    expect(mid).toBe(before + 1);

    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        username: uniq('linkuser').toLowerCase(),
        password: 'Test@1234',
        fullName: 'Linked User',
        role: 'partner',
        partnerPublicId: partner.publicId,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.entity.partner.publicId).toBe(partner.publicId);
    expect(await activePartnerCount()).toBe(mid);
  });

  it('creates a new partner record and links the user atomically, auditing both', async () => {
    const before = await activePartnerCount();
    const uname = uniq('newpuser').toLowerCase();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        username: uname,
        password: 'Test@1234',
        fullName: 'Brand New Partner User',
        role: 'partner',
        newPartner: { name: uniq('Brand New Partner'), phone: '9999999999', email: 'newp@example.com' },
      });
    expect(res.status).toBe(201);
    const user = res.body.data.entity;
    expect(user.partner).toBeTruthy();
    expect(user.partner.publicId).toBeTruthy();
    expect(await activePartnerCount()).toBe(before + 1);

    // The new partner record is real and retrievable.
    const got = await request(app)
      .get(`/api/v1/partners/${user.partner.publicId}`)
      .set(authHeader(adminToken));
    expect(got.status).toBe(200);
    expect(got.body.data.name).toContain('Brand New Partner');

    // Both pre-existing audit events are preserved.
    const partnerAudits = await auditsFor(user.partner.publicId);
    expect(partnerAudits).toEqual(
      expect.arrayContaining([{ action: 'create', domain: 'partners' }]),
    );
    const userAudits = await auditsFor(user.publicId);
    expect(userAudits).toEqual(
      expect.arrayContaining([{ action: 'user_create', domain: 'users' }]),
    );

    // The linked login actually works.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: uname, password: 'Test@1234' });
    expect(login.status).toBe(200);
  });

  it('rolls back the partner insert when user creation fails (duplicate username): no orphan', async () => {
    const uname = uniq('dupeuser').toLowerCase();
    const first = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({ username: uname, password: 'Test@1234', fullName: 'First', role: 'admin' });
    expect(first.status).toBe(201);

    const before = await activePartnerCount();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        username: uname,
        password: 'Test@1234',
        fullName: 'Second',
        role: 'partner',
        newPartner: { name: uniq('Orphan Must Not Exist') },
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
    expect(await activePartnerCount()).toBe(before);
  });

  it('rejects newPartner for non-partner roles without creating anything', async () => {
    const before = await activePartnerCount();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        username: uniq('adminnp').toLowerCase(),
        password: 'Test@1234',
        fullName: 'Admin No Partner',
        role: 'admin',
        newPartner: { name: uniq('Sneaky Partner') },
      });
    expect(res.status).toBe(400);
    expect(await activePartnerCount()).toBe(before);
  });

  it('rejects combining partnerPublicId with newPartner', async () => {
    const partner = await createPartnerRecord(uniq('BothModes'));
    const before = await activePartnerCount();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        username: uniq('bothuser').toLowerCase(),
        password: 'Test@1234',
        fullName: 'Both Modes',
        role: 'partner',
        partnerPublicId: partner.publicId,
        newPartner: { name: uniq('Second Partner') },
      });
    expect(res.status).toBe(400);
    expect(await activePartnerCount()).toBe(before);
  });

  it('rejects newPartner without a name (Partners-module validation reused)', async () => {
    const before = await activePartnerCount();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        username: uniq('noname').toLowerCase(),
        password: 'Test@1234',
        fullName: 'No Name Partner',
        role: 'partner',
        newPartner: { phone: '123' },
      });
    expect(res.status).toBe(400);
    expect(await activePartnerCount()).toBe(before);
  });

  it('preserves existing behavior: partner role without any link is still rejected', async () => {
    const before = await activePartnerCount();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        username: uniq('nolink').toLowerCase(),
        password: 'Test@1234',
        fullName: 'No Link',
        role: 'partner',
      });
    expect(res.status).toBe(400);
    expect(await activePartnerCount()).toBe(before);
  });

  it('forbids partner-role callers from exploiting the combined flow (403)', async () => {
    const p = await setupPartner(adminToken, 'npc');
    const before = await activePartnerCount();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(p.accessToken))
      .send({
        username: uniq('escalate').toLowerCase(),
        password: 'Test@1234',
        fullName: 'Escalation Attempt',
        role: 'partner',
        newPartner: { name: uniq('Escalated Partner') },
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await activePartnerCount()).toBe(before);
  });
});
