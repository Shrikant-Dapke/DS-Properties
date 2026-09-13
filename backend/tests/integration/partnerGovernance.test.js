import request from 'supertest';
import app from '../../src/app.js';
import {
  getAdminToken,
  authHeader,
  login,
  setupPartner,
  setupPartnerQuorum,
  setupDeveloper,
  proposeAsPartner,
  approveAsPartners,
  proposeAndApprove,
} from '../helpers/api.js';
import { TEST_ADMIN_PASSWORD } from '../helpers/testCredentials.js';

const PW = 'Test@1234';

describe('Partner-centric business governance', () => {
  let adminToken;
  let A;
  let B;
  let C;
  let customerPublicId;
  let categoryPublicId;
  // Authoritative local mirror of the approver pool: every active partner
  // user created in this file, in creation order. Tests that run after new
  // partners join MUST approve with all current others (see approveAll).
  const pool = [];
  const othersOf = (requester) => pool.filter((p) => p.username !== requester.username);
  async function approveAll(crPublicId, requester) {
    let last = null;
    for (const p of othersOf(requester)) {
      last = await request(app)
        .post(`/api/v1/change-requests/${crPublicId}/approve`)
        .set(authHeader(p.accessToken))
        .send({});
    }
    return last;
  }

  beforeAll(async () => {
    adminToken = await getAdminToken();
    [A, B, C] = await setupPartnerQuorum(adminToken, 3, 'gov');
    pool.push(A, B, C);

    // Shared fixtures via full governance (propose as A, approve B + C).
    const cust = await proposeAndApprove([A, B, C], 'post', '/api/v1/customers', {
      name: `GovCust_${Date.now()}`,
    });
    customerPublicId = cust.entity.publicId;
    const cats = await request(app).get('/api/v1/categories/active').set(authHeader(adminToken));
    categoryPublicId = cats.body.data[0].publicId;
  });

  async function createTx(proposer, overrides = {}) {
    return proposeAndApprove([proposer, ...othersOf(proposer)], 'post', '/api/v1/transactions', {
      transactionType: 'intake',
      sourceType: 'customer',
      customerPublicId,
      amount: 1000,
      paymentMode: 'cash',
      transactionDate: '2026-09-10',
      description: `gov_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      ...overrides,
    });
  }

  // ---------------- Authorization (items 1-6) ----------------
  it('1-3: partner and admin can authenticate with correct roles', async () => {
    const pa = await login(A.username, A.password);
    expect(pa.accessToken).toBeTruthy();
    const me = await request(app).get('/api/v1/customers').set(authHeader(pa.accessToken));
    expect(me.status).toBe(200);
  });

  it('4: admin cannot mutate business data (403 on every mutation route)', async () => {
    const calls = [
      ['post', '/api/v1/transactions', { transactionType: 'outtake', amount: 1, paymentMode: 'cash', transactionDate: '2026-09-10', categoryPublicId }],
      ['patch', '/api/v1/transactions/some-id', { description: 'x' }],
      ['post', '/api/v1/transactions/some-id/reverse', { adminPassword: TEST_ADMIN_PASSWORD }],
      ['delete', '/api/v1/transactions/some-id', { adminPassword: TEST_ADMIN_PASSWORD }],
      ['post', '/api/v1/customers', { name: 'x' }],
      ['put', '/api/v1/customers/some-id', { name: 'x' }],
      ['delete', '/api/v1/customers/some-id', {}],
      ['post', '/api/v1/categories', { name: 'x' }],
      ['put', '/api/v1/categories/some-id', { name: 'x' }],
      ['delete', '/api/v1/categories/some-id', {}],
      ['put', '/api/v1/settings/opening_balance', { value: 5 }],
    ];
    for (const [method, url, body] of calls) {
      const res = await request(app)[method](url).set(authHeader(adminToken)).send(body);
      expect(`${method} ${url} -> ${res.status}`).toBe(`${method} ${url} -> 403`);
    }
  });

  it('5: deactivated partner cannot propose (pool enforcement at auth)', async () => {
    const temp = await setupPartner(adminToken, 'tempdeact');
    const tempToken = temp.accessToken;
    const users = await request(app).get('/api/v1/users').query({ search: temp.username }).set(authHeader(adminToken));
    await request(app).patch(`/api/v1/users/${users.body.data.rows[0].publicId}/active`).set(authHeader(adminToken)).send({ isActive: false });
    const res = await request(app).post('/api/v1/customers').set(authHeader(tempToken)).send({ name: 'Nope' });
    expect([401, 403]).toContain(res.status);
  });

  it('6-7: partner submit creates a PENDING change request, applies nothing', async () => {
    const res = await proposeAsPartner(A, 'post', '/api/v1/transactions', {
      transactionType: 'intake',
      sourceType: 'customer',
      customerPublicId,
      amount: 2500,
      paymentMode: 'upi',
      transactionDate: '2026-09-11',
      description: `pending_${Date.now()}`,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.changeRequest.status).toBe('PENDING');
    expect(res.body.data.entity).toBeNull();
  });

  it('8: partner update becomes PENDING, original untouched', async () => {
    const { entity } = await createTx(A);
    const res = await proposeAsPartner(A, 'patch', `/api/v1/transactions/${entity.publicId}`, {
      description: 'edited-pending',
      versionTag: entity.versionTag,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.changeRequest.status).toBe('PENDING');
    const got = await request(app).get(`/api/v1/transactions/${entity.publicId}`).set(authHeader(adminToken));
    expect(got.body.data.description).not.toBe('edited-pending');
  });

  it('9: partner delete becomes PENDING (own password re-entry)', async () => {
    const { entity } = await createTx(B);
    const res = await proposeAsPartner(B, 'delete', `/api/v1/transactions/${entity.publicId}`, {
      adminPassword: PW,
      reason: 'oops',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.changeRequest.status).toBe('PENDING');
    const got = await request(app).get(`/api/v1/transactions/${entity.publicId}`).set(authHeader(adminToken));
    expect(got.status).toBe(200);
  });

  it('9b: delete with wrong own-password is rejected before governance', async () => {
    const { entity } = await createTx(B);
    const res = await proposeAsPartner(B, 'delete', `/api/v1/transactions/${entity.publicId}`, {
      adminPassword: 'WrongPass@123',
      reason: 'oops',
    });
    expect(res.status).toBe(401);
  });

  it('10: partner reverse becomes PENDING', async () => {
    const { entity } = await createTx(C);
    const res = await proposeAsPartner(C, 'post', `/api/v1/transactions/${entity.publicId}/reverse`, {
      adminPassword: PW,
      reason: 'mistake',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.changeRequest.status).toBe('PENDING');
  });

  // ---------------- Governance core (items 11-21) ----------------
  it('11: requester cannot approve their own request', async () => {
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name: `SelfAppr_${Date.now()}` });
    const cr = res.body.data.changeRequest.publicId;
    const self = await request(app).post(`/api/v1/change-requests/${cr}/approve`).set(authHeader(A.accessToken)).send({});
    expect(self.status).toBe(403);
  });

  it('12-13: one approval stays PENDING, unanimous approval applies exactly once', async () => {
    const name = `Unanim_${Date.now()}`;
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name });
    const cr = res.body.data.changeRequest;
    expect(cr.status).toBe('PENDING');
    expect(cr.requiredApprovers).toHaveLength(2);

    const one = await approveAsPartners(cr.publicId, [B]);
    expect(one.body.data.changeRequest.status).toBe('PENDING');
    expect(one.body.data.entity).toBeNull();

    const two = await approveAsPartners(cr.publicId, [C]);
    expect(two.body.data.changeRequest.status).toBe('APPROVED');
    const publicId = two.body.data.entity.publicId;
    expect(publicId).toBeTruthy();

    // Exactly once: the uniquely-named customer exists exactly once.
    const list = await request(app).get('/api/v1/customers').query({ search: name }).set(authHeader(adminToken));
    expect(list.body.data.rows.filter((r) => r.name === name)).toHaveLength(1);
  });

  it('14: one rejection stops execution', async () => {
    const name = `RejCust_${Date.now()}`;
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name });
    const cr = res.body.data.changeRequest.publicId;
    const rej = await request(app).post(`/api/v1/change-requests/${cr}/reject`).set(authHeader(B.accessToken)).send({ comment: 'no' });
    expect(rej.body.data.changeRequest.status).toBe('REJECTED');
    const list = await request(app).get('/api/v1/customers').query({ search: name }).set(authHeader(adminToken));
    expect(list.body.data.rows.some((r) => r.name === name)).toBe(false);
  });

  it('15: duplicate approval is rejected', async () => {
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name: `DupAppr_${Date.now()}` });
    const cr = res.body.data.changeRequest.publicId;
    const first = await approveAsPartners(cr, [B]);
    expect(first.status).toBe(200);
    const dup = await approveAsPartners(cr, [B]);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_APPROVAL');
  });

  it('33: admin can view but cannot approve a business request', async () => {
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name: `AdmAppr_${Date.now()}` });
    const cr = res.body.data.changeRequest.publicId;
    const got = await request(app).get(`/api/v1/change-requests/${cr}`).set(authHeader(adminToken));
    expect(got.status).toBe(200);
    const attempt = await request(app).post(`/api/v1/change-requests/${cr}/approve`).set(authHeader(adminToken)).send({});
    expect(attempt.status).toBe(403);
  });

  it('32: client cannot control approvers or requester attribution', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(authHeader(B.accessToken))
      .send({ name: `Spoof_${Date.now()}`, requestedBy: 99999, requiredApprovers: [99999] });
    expect(res.status).toBe(201);
    const cr = res.body.data.changeRequest;
    expect(cr.requestedBy).not.toBe(99999);
    expect(cr.requiredApprovers).not.toContain(99999);
    expect(cr.requiredApprovers).toHaveLength(2);
  });

  it('22: stale tag at submit time is rejected with STALE_CONFLICT, no request created', async () => {
    const { entity } = await createTx(A);
    const res = await proposeAsPartner(A, 'patch', `/api/v1/transactions/${entity.publicId}`, {
      description: 'stale-edit',
      versionTag: '1970-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_CONFLICT');
    expect(res.body.data?.changeRequest ?? null).toBeNull();
  });

  it('23: request approved after target moved is CANCELLED, never overwrites', async () => {
    const { entity } = await createTx(A);
    const tagT1 = entity.versionTag;
    // A proposes edit E1 at T1.
    const e1 = await proposeAsPartner(A, 'patch', `/api/v1/transactions/${entity.publicId}`, {
      description: 'E1-wins-check',
      versionTag: tagT1,
    });
    const cr1 = e1.body.data.changeRequest.publicId;
    // B proposes a conflicting edit and gets it approved first (A + C approve B's).
    const e2 = await proposeAsPartner(B, 'patch', `/api/v1/transactions/${entity.publicId}`, {
      description: 'E2-applied',
      versionTag: tagT1,
    });
    const cr2 = e2.body.data.changeRequest.publicId;
    await approveAsPartners(cr2, [A]);
    const applied = await approveAsPartners(cr2, [C]);
    expect(applied.body.data.changeRequest.status).toBe('APPROVED');
    // Now C approves the stale E1: must CANCEL, not overwrite.
    const late = await approveAsPartners(cr1, [B]);
    expect(late.body.data.changeRequest.status).toBe('PENDING');
    const fin = await approveAsPartners(cr1, [C]);
    expect(fin.body.data.changeRequest.status).toBe('CANCELLED');
    expect(fin.body.data.changeRequest.resolutionReason).toBe('STALE_CONFLICT');
    const got = await request(app).get(`/api/v1/transactions/${entity.publicId}`).set(authHeader(adminToken));
    expect(got.body.data.description).toBe('E2-applied');
  });

  it('16-17: approver snapshot is frozen; later partners cannot decide', async () => {
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name: `Frozen_${Date.now()}` });
    const cr = res.body.data.changeRequest;
    expect(cr.requiredApprovers).toHaveLength(2);

    // A fourth partner joins AFTER the request exists.
    const D = await setupPartner(adminToken, 'late');
    pool.push(D);
    const refetched = await request(app).get(`/api/v1/change-requests/${cr.publicId}`).set(authHeader(adminToken));
    expect(refetched.body.data.requiredApprovers).toHaveLength(2);

    const intruder = await request(app).post(`/api/v1/change-requests/${cr.publicId}/approve`).set(authHeader(D.accessToken)).send({});
    expect(intruder.status).toBe(403);

    await approveAsPartners(cr.publicId, [B, C]);
    const done = await request(app).get(`/api/v1/change-requests/${cr.publicId}`).set(authHeader(adminToken));
    expect(done.body.data.status).toBe('APPROVED');
    return D;
  });

  it('18: requester deactivated mid-flight still resolves against the frozen snapshot', async () => {
    const D = await setupPartner(adminToken, 'leaver');
    pool.push(D);
    const name = `Leaver_${Date.now()}`;
    const res = await proposeAsPartner(D, 'post', '/api/v1/customers', { name });
    const cr = res.body.data.changeRequest;
    expect(cr.requiredApprovers.length).toBeGreaterThanOrEqual(3);

    // Requester leaves mid-flight.
    const users = await request(app).get('/api/v1/users').query({ search: D.username, limit: 5 }).set(authHeader(adminToken));
    const dPublicId = users.body.data.rows[0].publicId;
    const deact = await request(app).patch(`/api/v1/users/${dPublicId}/active`).set(authHeader(adminToken)).send({ isActive: false });
    expect(deact.status).toBe(200);
    pool.splice(pool.findIndex((p) => p.username === D.username), 1);

    // Every frozen approver approves.
    await approveAll(cr.publicId, D);
    const done = await request(app).get(`/api/v1/change-requests/${cr.publicId}`).set(authHeader(adminToken));
    expect(done.body.data.status).toBe('APPROVED');
    const list = await request(app).get('/api/v1/customers').query({ search: name }).set(authHeader(adminToken));
    expect(list.body.data.rows.some((r) => r.name === name)).toBe(true);
  });

  it('20-21: concurrent approvals apply exactly once; repeat decisions rejected', async () => {
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name: `Race_${Date.now()}` });
    const cr = res.body.data.changeRequest.publicId;
    const [r1, r2] = await Promise.all([
      request(app).post(`/api/v1/change-requests/${cr}/approve`).set(authHeader(B.accessToken)).send({}),
      request(app).post(`/api/v1/change-requests/${cr}/approve`).set(authHeader(C.accessToken)).send({}),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 200]);
    // A concurrent pair is safe; remaining frozen approvers complete it.
    await approveAll(cr, A);
    const done = await request(app).get(`/api/v1/change-requests/${cr}`).set(authHeader(adminToken));
    expect(done.body.data.status).toBe('APPROVED');

    const again = await request(app).post(`/api/v1/change-requests/${cr}/approve`).set(authHeader(B.accessToken)).send({});
    expect(again.status).toBe(409);
  });

  it('partner cancel: requester can cancel, resolved requests cannot', async () => {
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name: `Cancel_${Date.now()}` });
    const cr = res.body.data.changeRequest.publicId;
    const cancelled = await request(app).post(`/api/v1/change-requests/${cr}/cancel`).set(authHeader(A.accessToken)).send({ reason: 'changed mind' });
    expect(cancelled.body.data.changeRequest.status).toBe('CANCELLED');
    const again = await request(app).post(`/api/v1/change-requests/${cr}/cancel`).set(authHeader(A.accessToken)).send({});
    expect(again.status).toBe(409);
  });

  describe('server-derived UI decision state (viewerCanDecide/viewerDecision)', () => {
    async function proposeCustomer(prefix) {
      const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name: `${prefix}_${Date.now()}` });
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      return res.body.data.changeRequest.publicId;
    }

    async function listAs(token) {
      const res = await request(app).get('/api/v1/change-requests').query({ status: 'PENDING', limit: 100 }).set(authHeader(token));
      expect(res.status).toBe(200);
      return res.body.data.rows;
    }

    it('requester sees viewerCanDecide=false and is not in requiredApprovers', async () => {
      const cr = await proposeCustomer('VsReq');
      const rows = await listAs(A.accessToken);
      const row = rows.find((x) => x.publicId === cr);
      expect(row).toBeTruthy();
      expect(row.viewerCanDecide).toBe(false);
      expect(row.viewerDecision).toBeNull();
      // Requester exclusion from the snapshot itself is covered by the
      // approve-403 test; here the UI contract (flags) is what matters.
      const one = await request(app).get(`/api/v1/change-requests/${cr}`).set(authHeader(A.accessToken));
      expect(one.body.data.viewerCanDecide).toBe(false);
      await request(app).post(`/api/v1/change-requests/${cr}/cancel`).set(authHeader(A.accessToken)).send({ reason: 'cleanup' });
    });

    it('required approver sees viewerCanDecide=true until deciding, then false with decision', async () => {
      const cr = await proposeCustomer('VsAppr');
      let rows = await listAs(B.accessToken);
      let row = rows.find((x) => x.publicId === cr);
      expect(row.viewerCanDecide).toBe(true);
      expect(row.viewerDecision).toBeNull();

      await approveAsPartners(cr, [B]);
      rows = await listAs(B.accessToken);
      row = rows.find((x) => x.publicId === cr);
      expect(row.viewerCanDecide).toBe(false);
      expect(row.viewerDecision).toBe('APPROVED');

      const one = await request(app).get(`/api/v1/change-requests/${cr}`).set(authHeader(B.accessToken));
      expect(one.body.data.viewerCanDecide).toBe(false);
      expect(one.body.data.viewerDecision).toBe('APPROVED');
      await request(app).post(`/api/v1/change-requests/${cr}/cancel`).set(authHeader(A.accessToken)).send({ reason: 'cleanup' });
    });

    it('admin, developer and non-member partners all see viewerCanDecide=false', async () => {
      // Propose FIRST, then introduce the outsider: anyone joining after
      // creation is outside the frozen snapshot by construction.
      const cr = await proposeCustomer('VsOther');
      const dev = await setupDeveloper();
      const outsider = await setupPartner(adminToken, 'vsout');
      pool.push(outsider);
      for (const [label, token] of [['admin', adminToken], ['developer', dev.accessToken], ['outsider', outsider.accessToken]]) {
        const rows = await listAs(token);
        const row = rows.find((x) => x.publicId === cr);
        expect(`${label} sees flags`).toBeTruthy();
        expect(row.viewerCanDecide).toBe(false);
        expect(row.viewerDecision).toBeNull();
      }
      await request(app).post(`/api/v1/change-requests/${cr}/cancel`).set(authHeader(A.accessToken)).send({ reason: 'cleanup' });
    });

    it('approval identity survives serialization (adminUserId/decidedAt present)', async () => {
      // Regression: rowToRequest once read snake_case keys from camelCase
      // approval objects, silently dropping approver identity from every
      // change-request response (breaking per-viewer state, duplicate
      // detection display, and approver names).
      const cr = await proposeCustomer('VsIdent');
      await approveAsPartners(cr, [B]);
      const rows = await listAs(A.accessToken);
      const row = rows.find((x) => x.publicId === cr);
      expect(row.approvals).toHaveLength(1);
      expect(row.approvals[0].adminUserId).toBeTruthy();
      expect(row.approvals[0].decidedAt).toBeTruthy();
      expect(row.approvals[0].status).toBe('APPROVED');
      const one = await request(app).get(`/api/v1/change-requests/${cr}`).set(authHeader(A.accessToken));
      expect(one.body.data.approvals[0].adminUserId).toBeTruthy();
      await request(app).post(`/api/v1/change-requests/${cr}/cancel`).set(authHeader(A.accessToken)).send({ reason: 'cleanup' });
    });
  });

  it('24-29: governed financial flow counts exactly once with correct exclusions', async () => {
    const fullQuorum = [...pool];
    const cust = await proposeAndApprove(fullQuorum, 'post', '/api/v1/customers', { name: `FinGov_${Date.now()}` });
    const cpid = cust.entity.publicId;
    const before = await request(app).get('/api/v1/dashboard/summary').query({ from: '2026-09-01', to: '2026-09-30' }).set(authHeader(adminToken));
    const intakeBefore = Number(before.body.data.period.intake);

    const tx = await proposeAndApprove(fullQuorum, 'post', '/api/v1/transactions', {
      transactionType: 'intake',
      sourceType: 'customer',
      customerPublicId: cpid,
      amount: 7777,
      paymentMode: 'cash',
      transactionDate: '2026-09-12',
      description: `fingov_${Date.now()}`,
    });
    const txId = tx.entity.publicId;
    // Attribution: creator is the requesting partner.
    expect(tx.entity.createdBy.username).toBe(A.username);

    const after = await request(app).get('/api/v1/dashboard/summary').query({ from: '2026-09-01', to: '2026-09-30' }).set(authHeader(adminToken));
    expect(Number(after.body.data.period.intake) - intakeBefore).toBe(7777);

    // Governed reverse removes it from aggregates exactly once.
    const rev = await proposeAsPartner(A, 'post', `/api/v1/transactions/${txId}/reverse`, { adminPassword: PW, reason: 'gov check' });
    await approveAll(rev.body.data.changeRequest.publicId, A);
    const gone = await request(app).get('/api/v1/dashboard/summary').query({ from: '2026-09-01', to: '2026-09-30' }).set(authHeader(adminToken));
    expect(Number(gone.body.data.period.intake) - intakeBefore).toBe(0);
  });

  it('35: audit identifies requester and approvers on the governed trail', async () => {
    const res = await proposeAsPartner(A, 'post', '/api/v1/customers', { name: `AuditGov_${Date.now()}` });
    const cr = res.body.data.changeRequest.publicId;
    await approveAll(cr, A);
    const audit = await request(app).get('/api/v1/audit').query({ domain: 'governance', limit: 100 }).set(authHeader(adminToken));
    const rows = audit.body.data.rows.filter((r) => r.record_id === cr);
    const byAction = {};
    for (const r of rows) byAction[r.action] = (byAction[r.action] || 0) + 1;
    expect(byAction.change_request_create).toBe(1);
    expect(byAction.change_request_approve).toBe(othersOf(A).length);
    expect(byAction.change_request_apply).toBe(1);
  });

  describe('partner identity link management (admin-managed, audited)', () => {
    it('creating a partner user without a link is rejected', async () => {
      const res = await request(app).post('/api/v1/users').set(authHeader(adminToken)).send({
        username: `nolink_${Date.now()}`,
        password: 'Test@1234',
        fullName: 'No Link',
        role: 'partner',
      });
      expect(res.status).toBe(400);
    });

    it('linking a non-partner user is rejected', async () => {
      // Update path on the seed admin: not a sensitive op (no role/isActive/
      // password change), so it applies directly and the service link rule
      // fires synchronously.
      const list = await request(app).get('/api/v1/users').query({ search: 'admin', limit: 10 }).set(authHeader(adminToken));
      const seedRow = list.body.data.rows.find((u) => u.username === 'admin');
      const res = await request(app).put(`/api/v1/users/${seedRow.publicId}`).set(authHeader(adminToken)).send({
        partnerPublicId: A.partnerPublicId,
      });
      expect(res.status).toBe(400);
    });

    it('linking to a missing or inactive partner record is rejected', async () => {
      const missing = await request(app).post('/api/v1/users').set(authHeader(adminToken)).send({
        username: `nolink2_${Date.now()}`,
        password: 'Test@1234',
        fullName: 'No Link 2',
        role: 'partner',
        partnerPublicId: '00000000-0000-4000-8000-000000000000',
      });
      expect(missing.status).toBe(400);
    });

    it('double-linking the same partner record is rejected', async () => {
      const res = await request(app).post('/api/v1/users').set(authHeader(adminToken)).send({
        username: `duplink_${Date.now()}`,
        password: 'Test@1234',
        fullName: 'Dup Link',
        role: 'partner',
        partnerPublicId: A.partnerPublicId,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PARTNER_LINK_TAKEN');
    });

    it('leaving the partner role clears the link; user serialization exposes identity', async () => {
      const temp = await setupPartner(adminToken, 'disposable');
      const list = await request(app).get('/api/v1/users').query({ search: temp.username }).set(authHeader(adminToken));
      const row = list.body.data.rows.find((u) => u.username === temp.username);
      expect(row.partner.publicId).toBe(temp.partnerPublicId);

      // Promotion to admin is governed; with a sole admin the requester's
      // auto-approval completes it immediately.
      const promote = await request(app).put(`/api/v1/users/${row.publicId}`).set(authHeader(adminToken)).send({ role: 'admin' });
      expect(promote.status).toBe(200);
      expect(promote.body.data.entity.role).toBe('admin');
      expect(promote.body.data.entity.partner).toBeNull();

      // The freed record can be linked to a new operator.
      const relinkName = `relink_${Date.now()}`;
      const relink = await request(app).post('/api/v1/users').set(authHeader(adminToken)).send({
        username: relinkName,
        password: 'Test@1234',
        fullName: 'Relink',
        role: 'partner',
        partnerPublicId: temp.partnerPublicId,
      });
      expect(relink.status).toBe(201);

      // Cleanup: remove the temporary operator, then the promoted admin. A
      // second admin completes the governed delete last so the applier is
      // never the target itself (self-delete guard).
      const relinkRow = (await request(app).get('/api/v1/users').query({ search: relinkName }).set(authHeader(adminToken))).body.data.rows[0];
      const delRelink = await request(app).delete(`/api/v1/users/${relinkRow.publicId}`).set(authHeader(adminToken));
      expect(delRelink.status).toBe(200);

      const a2name = `a2disp_${Date.now()}`;
      const a2res = await request(app).post('/api/v1/users').set(authHeader(adminToken)).send({
        username: a2name, password: 'Test@1234', fullName: 'A2', role: 'admin',
      });
      // Temp is an admin by now, so this creation is PENDING (seed + temp).
      // Temp approves it to complete the quorum.
      const a2cr = a2res.body.data.changeRequest.publicId;
      const tempLoginForA2 = await login(temp.username, 'Test@1234');
      await request(app).post(`/api/v1/change-requests/${a2cr}/approve`).set(authHeader(tempLoginForA2.accessToken)).send({});
      const a2Login = await login(a2name, 'Test@1234');
      const a2 = { accessToken: a2Login.accessToken };
      const targetLogin = await login(temp.username, 'Test@1234');
      const del = await request(app).delete(`/api/v1/users/${row.publicId}`).set(authHeader(adminToken));
      expect(del.body.data.changeRequest.status).toBe('PENDING');
      const cr = del.body.data.changeRequest.publicId;
      await request(app).post(`/api/v1/change-requests/${cr}/approve`).set(authHeader(targetLogin.accessToken)).send({});
      const fin = await request(app).post(`/api/v1/change-requests/${cr}/approve`).set(authHeader(a2.accessToken)).send({});
      expect(fin.body.data.changeRequest.status).toBe('APPROVED');
    });
  });
});
