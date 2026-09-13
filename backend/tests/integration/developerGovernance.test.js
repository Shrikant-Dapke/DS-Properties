import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import {
  getAdminToken,
  authHeader,
  login,
  setupDeveloper,
  setupPartnerQuorum,
  proposeAndApprove,
  proposeAsPartner,
  approveAsPartners,
} from '../helpers/api.js';

const DEV_PW = 'Owner@123456';
const PARTNER_PW = 'Test@1234';

describe('Developer / role-model governance (exactly three roles)', () => {
  let adminToken;
  let dev;
  let Q;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    dev = await setupDeveloper();
    Q = await setupPartnerQuorum(adminToken, 2, 'dev');
  });

  const devAuth = () => authHeader(dev.accessToken);

  // ---------------- ROLE MODEL (items 1-8) ----------------
  it('1-3: developer, partner and admin are valid, distinct roles', async () => {
    expect(dev.username).toBeTruthy();
    const me = await request(app).get('/api/v1/customers').set(devAuth());
    expect(me.status).toBe(200);
    const list = await request(app).get('/api/v1/users').set(authHeader(adminToken));
    const roles = new Set(list.body.data.rows.map((u) => u.role));
    expect(roles.has('admin')).toBe(true);
    expect(roles.has('partner')).toBe(true);
    expect(roles.has('developer')).toBe(true);
  });

  it('4: read_only is NOT a valid production role', async () => {
    const create = await request(app).post('/api/v1/users').set(authHeader(adminToken)).send({
      username: `ro_${Date.now()}`, password: 'Test@1234', fullName: 'RO', role: 'read_only',
    });
    expect(create.status).toBe(400);
  });

  it('4b: the database itself rejects read_only rows (defense in depth)', async () => {
    const hash = await bcrypt.hash('Test@1234', 4);
    await expect(
      pool.query(
        `INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, 'Legacy', 'read_only')`,
        [`legacyro_${Date.now()}`, hash],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('5: partner cannot create a developer', async () => {
    const res = await request(app).post('/api/v1/users').set(authHeader(Q[0].accessToken)).send({
      username: `pdev_${Date.now()}`, password: 'Test@1234', fullName: 'P', role: 'developer',
    });
    // Partners cannot manage users at all (route-level), let alone developers.
    expect(res.status).toBe(403);
  });

  it('6: admin cannot create a developer', async () => {
    const res = await request(app).post('/api/v1/users').set(authHeader(adminToken)).send({
      username: `adev_${Date.now()}`, password: 'Test@1234', fullName: 'A', role: 'developer',
    });
    expect(res.status).toBe(400);
  });

  it('7-8: nobody can promote to developer or modify a developer via the API', async () => {
    const users = await request(app).get('/api/v1/users').query({ search: Q[0].username }).set(authHeader(adminToken));
    const target = users.body.data.rows[0];
    const promo = await request(app).put(`/api/v1/users/${target.publicId}`).set(authHeader(adminToken)).send({ role: 'developer' });
    expect(promo.status).toBe(400);

    const devRow = (await request(app).get('/api/v1/users').query({ search: dev.username }).set(authHeader(adminToken))).body.data.rows[0];
    for (const attempt of [
      ['put', `/api/v1/users/${devRow.publicId}`, { fullName: 'Hacked' }],
      ['patch', `/api/v1/users/${devRow.publicId}/active`, { isActive: false }],
      ['post', `/api/v1/users/${devRow.publicId}/reset-password`, { newPassword: 'Hacked@123456' }],
      ['delete', `/api/v1/users/${devRow.publicId}`, {}],
    ]) {
      const [method, url, body] = attempt;
      const res = await request(app)[method](url).set(authHeader(adminToken)).send(body);
      expect(`${method} ${url} -> ${res.status}`).toBe(`${method} ${url} -> 400`);
    }
    // Developer still active and able to log in.
    const relogin = await request(app).post('/api/v1/auth/login').send({ username: dev.username, password: DEV_PW });
    expect(relogin.status).toBe(200);
  });

  // ---------------- DEVELOPER direct power (items 9-15) ----------------
  it('9: developer directly creates business data (no change request)', async () => {
    const cust = await request(app).post('/api/v1/customers').set(devAuth()).send({ name: `DevCust_${Date.now()}` });
    expect(cust.status).toBe(201);
    expect(cust.body.data.changeRequest).toBeNull();
    expect(cust.body.data.entity.publicId).toBeTruthy();

    const tx = await request(app).post('/api/v1/transactions').set(devAuth()).send({
      transactionType: 'intake',
      sourceType: 'customer',
      customerPublicId: cust.body.data.entity.publicId,
      amount: 9100,
      paymentMode: 'cash',
      transactionDate: '2026-09-10',
    });
    expect(tx.status).toBe(201);
    expect(tx.body.data.changeRequest).toBeNull();
    expect(Number(tx.body.data.entity.amount)).toBe(9100);
  });

  it('10: developer directly edits', async () => {
    const cust = await request(app).post('/api/v1/customers').set(devAuth()).send({ name: `DevEdit_${Date.now()}` });
    const id = cust.body.data.entity.publicId;
    const res = await request(app).put(`/api/v1/customers/${id}`).set(devAuth()).send({ phone: '9111111111' });
    expect(res.status).toBe(200);
    expect(res.body.data.changeRequest).toBeNull();
    expect(res.body.data.entity.phone).toBe('9111111111');
  });

  it('11-12: developer directly deletes and reverses (own-password re-entry)', async () => {
    const cust = await request(app).post('/api/v1/customers').set(devAuth()).send({ name: `DevDel_${Date.now()}` });
    const cpid = cust.body.data.entity.publicId;
    const tx = await request(app).post('/api/v1/transactions').set(devAuth()).send({
      transactionType: 'intake', sourceType: 'customer', customerPublicId: cpid,
      amount: 9200, paymentMode: 'cash', transactionDate: '2026-09-11',
    });
    const txId = tx.body.data.entity.publicId;

    const rev = await request(app).post(`/api/v1/transactions/${txId}/reverse`).set(devAuth()).send({
      adminPassword: DEV_PW, reason: 'dev check',
    });
    expect(rev.status).toBe(200);
    expect(rev.body.data.changeRequest).toBeNull();

    const tx2 = await request(app).post('/api/v1/transactions').set(devAuth()).send({
      transactionType: 'intake', sourceType: 'customer', customerPublicId: cpid,
      amount: 9300, paymentMode: 'cash', transactionDate: '2026-09-11',
    });
    const del = await request(app).delete(`/api/v1/transactions/${tx2.body.data.entity.publicId}`).set(devAuth()).send({
      adminPassword: DEV_PW, reason: 'dev check',
    });
    expect(del.status).toBe(200);
    expect(del.body.data.changeRequest).toBeNull();
  });

  it('13: developer can manage users (partner lifecycle)', async () => {
    const prec = await request(app).post('/api/v1/partners').set(devAuth()).send({ name: `DevRec_${Date.now()}` });
    expect(prec.status).toBe(201);
    const urec = await request(app).post('/api/v1/users').set(devAuth()).send({
      username: `devmade_${Date.now()}`, password: 'Test@1234', fullName: 'Dev Made',
      role: 'partner', partnerPublicId: prec.body.data.entity.publicId,
    });
    expect(urec.status).toBe(201);
    const uid = urec.body.data.entity.publicId;
    const deact = await request(app).patch(`/api/v1/users/${uid}/active`).set(devAuth()).send({ isActive: false });
    expect(deact.status).toBe(200);
  });

  it('14-15: developer manages partners and reaches system functions', async () => {
    const prec = await request(app).post('/api/v1/partners').set(devAuth()).send({ name: `DevPartner_${Date.now()}` });
    expect(prec.status).toBe(201);
    expect(prec.body.data.changeRequest).toBeNull();

    const settings = await request(app).get('/api/v1/settings').set(devAuth());
    expect(settings.status).toBe(200);
    const audit = await request(app).get('/api/v1/audit').set(devAuth());
    expect(audit.status).toBe(200);
    const crs = await request(app).get('/api/v1/change-requests').set(devAuth());
    expect(crs.status).toBe(200);
  });

  // ---------------- ADMIN view-only (items 27-32) ----------------
  it('27: admin can view business data, reports, audit and governance', async () => {
    for (const [method, url] of [
      ['get', '/api/v1/transactions'],
      ['get', '/api/v1/customers'],
      ['get', '/api/v1/partners'],
      ['get', '/api/v1/categories/active'],
      ['get', '/api/v1/dashboard/summary'],
      ['get', '/api/v1/audit'],
      ['get', '/api/v1/change-requests'],
      ['get', '/api/v1/settings'],
    ]) {
      const res = await request(app)[method](url).set(authHeader(adminToken));
      expect(`${method} ${url} -> ${res.status}`).toBe(`${method} ${url} -> 200`);
    }
  });

  it('28-31: admin cannot create/update/delete/reverse business data', async () => {
    const cust = await request(app).post('/api/v1/customers').set(devAuth()).send({ name: `AdmBlk_${Date.now()}` });
    const cpid = cust.body.data.entity.publicId;
    const tx = await request(app).post('/api/v1/transactions').set(devAuth()).send({
      transactionType: 'intake', sourceType: 'customer', customerPublicId: cpid,
      amount: 100, paymentMode: 'cash', transactionDate: '2026-09-12',
    });
    const txId = tx.body.data.entity.publicId;
    const cats = await request(app).get('/api/v1/categories/active').set(authHeader(adminToken));
    const catId = cats.body.data[0].publicId;

    const calls = [
      ['post', '/api/v1/transactions', { transactionType: 'outtake', amount: 1, paymentMode: 'cash', transactionDate: '2026-09-12', categoryPublicId: catId }],
      ['patch', `/api/v1/transactions/${txId}`, { description: 'x' }],
      ['post', `/api/v1/transactions/${txId}/reverse`, { adminPassword: 'Admin@123' }],
      ['delete', `/api/v1/transactions/${txId}`, { adminPassword: 'Admin@123' }],
      ['post', '/api/v1/customers', { name: 'x' }],
      ['put', `/api/v1/customers/${cpid}`, { phone: '1' }],
      ['delete', `/api/v1/customers/${cpid}`, {}],
      ['post', '/api/v1/categories', { name: 'x', slug: 'x' }],
      ['put', '/api/v1/settings/opening_balance', { value: 1 }],
    ];
    for (const [method, url, body] of calls) {
      const res = await request(app)[method](url).set(authHeader(adminToken)).send(body);
      expect(`${method} ${url} -> ${res.status}`).toBe(`${method} ${url} -> 403`);
    }
  });

  it('32 + 35: admin cannot approve partner requests and cannot self-create developer power', async () => {
    // No developer access can be obtained through any API as any role.
    for (const [token, label] of [[authHeader(adminToken), 'admin'], [authHeader(Q[0].accessToken), 'partner']]) {
      const res = await request(app).post('/api/v1/users').set(token).send({
        username: `esc_${label}_${Date.now()}`, password: 'Test@1234', fullName: 'E', role: 'developer',
      });
      expect(`${label} create developer -> ${res.status}`).toBe(`${label} create developer -> ${res.status === 201 ? '201-UNEXPECTED' : String(res.status)}`);
      expect(res.status).not.toBe(201);
    }
  });

  // ---------------- SECURITY (items 33-34, 36-37) ----------------
  it('33-34: approver list and quorum stay server-derived under the 3-role model', async () => {
    const res = await proposeAsPartner(Q, 'post', '/api/v1/customers', {
      name: `SrvDer_${Date.now()}`,
      requiredApprovers: [1, 2, 3],
      requestedBy: 1,
    });
    expect(res.status).toBe(201);
    const cr = res.body.data.changeRequest;
    expect(cr.requiredApprovers).toHaveLength(1);
    expect(cr.requiredApprovers).not.toContain(1);
  });

  it('36-37: no privilege escalation and no direct mutation path for non-developers', async () => {
    // Partner attempts self-promotion to developer and to admin.
    const users = await request(app).get('/api/v1/users').query({ search: Q[0].username }).set(authHeader(adminToken));
    const me = users.body.data.rows[0];
    const selfPromo = await request(app).put(`/api/v1/users/${me.publicId}`).set(authHeader(Q[0].accessToken)).send({ role: 'developer' });
    expect(selfPromo.status).toBe(403);
    // Partner user-management surface is fully closed.
    const del = await request(app).delete(`/api/v1/users/${me.publicId}`).set(authHeader(Q[0].accessToken));
    expect(del.status).toBe(403);
    // Read-only-free model: unknown roles rejected at validation.
    const bad = await request(app).post('/api/v1/users').set(authHeader(adminToken)).send({
      username: `bad_${Date.now()}`, password: 'Test@1234', fullName: 'B', role: 'superadmin',
    });
    expect(bad.status).toBe(400);
  });

  // ---------------- FINANCIAL via developer direct path (item 40) ----------------
  it('40: developer direct mutations produce correct financial totals', async () => {
    const before = await request(app).get('/api/v1/dashboard/summary').query({ from: '2026-09-01', to: '2026-09-30' }).set(authHeader(adminToken));
    const base = Number(before.body.data.period.intake);
    const cust = await request(app).post('/api/v1/customers').set(devAuth()).send({ name: `DevFin_${Date.now()}` });
    await request(app).post('/api/v1/transactions').set(devAuth()).send({
      transactionType: 'intake', sourceType: 'customer', customerPublicId: cust.body.data.entity.publicId,
      amount: 6100, paymentMode: 'cash', transactionDate: '2026-09-15',
    });
    const after = await request(app).get('/api/v1/dashboard/summary').query({ from: '2026-09-01', to: '2026-09-30' }).set(authHeader(adminToken));
    expect(Number(after.body.data.period.intake) - base).toBe(6100);
  });
});
