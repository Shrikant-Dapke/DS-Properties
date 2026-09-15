import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import {
  getAdminToken,
  authHeader,
  setupPartner,
  setupPartnerQuorum,
  setupDeveloper,
} from '../helpers/api.js';

function uniq(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// Partner-initiated user governance: PARTNERS govern PARTNERS. A partner may
// initiate sensitive user operations, never execute them; OTHER active
// partners review. Admins are not reviewers; the requester can never
// self-approve; inactive partners cannot decide.
describe('Partner-initiated user approval flow (partners govern partners)', () => {
  let adminToken;
  let A;
  let B;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    [A, B] = await setupPartnerQuorum(adminToken, 2, 'pgov');
  });

  async function userIdByUsername(username) {
    const r = await pool.query('SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL', [username]);
    return r.rows[0]?.id ?? null;
  }

  async function userRowByUsername(username) {
    const r = await pool.query(
      'SELECT public_id, role, is_active FROM users WHERE username = $1 AND deleted_at IS NULL',
      [username],
    );
    return r.rows[0] || null;
  }

  async function proposeAdminCreation(proposerToken, username) {
    return request(app)
      .post('/api/v1/users')
      .set(authHeader(proposerToken))
      .send({ username, password: 'Test@1234', fullName: 'Proposed Admin', role: 'admin' });
  }

  // A. Partner A initiates; reviewers are other partners, requester excluded.
  it('A: partner A initiates with other partners (never self/admins) as reviewers', async () => {
    const username = uniq('wantadmin').toLowerCase();
    const res = await proposeAdminCreation(A.accessToken, username);
    expect(res.status).toBe(201);
    expect(res.body.data.changeRequest.status).toBe('PENDING');
    expect(res.body.data.entity).toBeNull();

    const aId = await userIdByUsername(A.username);
    const bId = await userIdByUsername(B.username);
    const snap = res.body.data.changeRequest.requiredApprovers.map(String);
    expect(snap).toEqual([String(bId)]);
    expect(snap).not.toContain(String(aId));
  });

  // B. No direct execution.
  it('B: initiation has no direct effect', async () => {
    const username = uniq('noeffect').toLowerCase();
    await proposeAdminCreation(A.accessToken, username);
    expect(await userRowByUsername(username)).toBeNull();
    const login = await request(app).post('/api/v1/auth/login').send({ username, password: 'Test@1234' });
    expect(login.status).toBe(401);
  });

  // C. Partner B (eligible reviewer) can see the request.
  it('C: partner B sees the pending request', async () => {
    const username = uniq('visible').toLowerCase();
    const prop = await proposeAdminCreation(A.accessToken, username);
    const crId = prop.body.data.changeRequest.publicId;

    const list = await request(app)
      .get('/api/v1/change-requests')
      .query({ status: 'PENDING', entityType: 'user' })
      .set(authHeader(B.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data.rows.map((r) => r.publicId)).toContain(crId);

    const single = await request(app).get(`/api/v1/change-requests/${crId}`).set(authHeader(B.accessToken));
    expect(single.status).toBe(200);
    expect(single.body.data.viewerCanDecide).toBe(true);
  });

  // D. Partner B approves -> executes (two-partner quorum: B alone completes it).
  it('D: partner B approval executes the operation', async () => {
    const username = uniq('approveadmin').toLowerCase();
    const prop = await proposeAdminCreation(A.accessToken, username);

    const approval = await request(app)
      .post(`/api/v1/change-requests/${prop.body.data.changeRequest.publicId}/approve`)
      .set(authHeader(B.accessToken))
      .send({ comment: 'reviewed' });
    expect(approval.status).toBe(200);
    expect(approval.body.data.changeRequest.status).toBe('APPROVED');
    expect(approval.body.data.entity.username).toBe(username);
    expect(approval.body.data.entity.role).toBe('admin');
    expect((await userRowByUsername(username))?.role).toBe('admin');
  });

  // E. Requester cannot self-approve.
  it('E: partner A cannot approve their own request', async () => {
    const prop = await proposeAdminCreation(A.accessToken, uniq('selfappr').toLowerCase());
    const attempt = await request(app)
      .post(`/api/v1/change-requests/${prop.body.data.changeRequest.publicId}/approve`)
      .set(authHeader(A.accessToken))
      .send({});
    expect(attempt.status).toBe(403);
    const still = await request(app)
      .get(`/api/v1/change-requests/${prop.body.data.changeRequest.publicId}`)
      .set(authHeader(B.accessToken));
    expect(still.body.data.status).toBe('PENDING');
  });

  // F. Admins are not reviewers for partner-governed requests.
  it('F: admin cannot approve a partner-governed request', async () => {
    const prop = await proposeAdminCreation(A.accessToken, uniq('adminappr').toLowerCase());
    const attempt = await request(app)
      .post(`/api/v1/change-requests/${prop.body.data.changeRequest.publicId}/approve`)
      .set(authHeader(adminToken))
      .send({});
    expect(attempt.status).toBe(403);
    const single = await request(app)
      .get(`/api/v1/change-requests/${prop.body.data.changeRequest.publicId}`)
      .set(authHeader(adminToken));
    expect(single.status).toBe(200);
    expect(single.body.data.status).toBe('PENDING');
    expect(single.body.data.viewerCanDecide).toBe(false);
  });

  // H. Rejection prevents execution.
  it('H: rejection by partner B prevents execution', async () => {
    const username = uniq('rejectadmin').toLowerCase();
    const prop = await proposeAdminCreation(A.accessToken, username);
    const rejection = await request(app)
      .post(`/api/v1/change-requests/${prop.body.data.changeRequest.publicId}/reject`)
      .set(authHeader(B.accessToken))
      .send({ comment: 'not now' });
    expect(rejection.status).toBe(200);
    expect(rejection.body.data.changeRequest.status).toBe('REJECTED');
    expect(await userRowByUsername(username)).toBeNull();
  });

  // I+J. Exactly-once execution with a complete audit trail.
  it('I+J: approval executes exactly once with complete audits', async () => {
    const username = uniq('onceadmin').toLowerCase();
    const prop = await proposeAdminCreation(A.accessToken, username);
    const crId = prop.body.data.changeRequest.publicId;

    const approval = await request(app)
      .post(`/api/v1/change-requests/${crId}/approve`)
      .set(authHeader(B.accessToken))
      .send({});
    expect(approval.body.data.changeRequest.status).toBe('APPROVED');

    const retry = await request(app)
      .post(`/api/v1/change-requests/${crId}/approve`)
      .set(authHeader(B.accessToken))
      .send({});
    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe('ALREADY_RESOLVED');

    const dupes = await pool.query(
      'SELECT count(*)::int AS total FROM users WHERE username = $1 AND deleted_at IS NULL',
      [username],
    );
    expect(dupes.rows[0].total).toBe(1);

    const audits = await pool.query(
      'SELECT action, domain FROM audit_logs WHERE record_id = $1 ORDER BY id',
      [crId],
    );
    const actions = audits.rows.map((a) => `${a.domain}:${a.action}`);
    expect(actions).toEqual(
      expect.arrayContaining([
        'governance:change_request_create',
        'governance:change_request_approve',
        'governance:change_request_apply',
      ]),
    );
    const userAudits = await pool.query('SELECT action, domain FROM audit_logs WHERE record_id = $1', [
      approval.body.data.entity.publicId,
    ]);
    expect(userAudits.rows.map((a) => `${a.domain}:${a.action}`)).toContain('users:user_create');
  });

  // Multiple partners: all others are eligible, requester excluded, unanimous.
  it('multiple active partners are all eligible reviewers except the requester', async () => {
    const C = await setupPartner(adminToken, 'pgovc');
    const aId = String(await userIdByUsername(A.username));
    const bId = String(await userIdByUsername(B.username));
    const cId = String(await userIdByUsername(C.username));

    const prop = await proposeAdminCreation(A.accessToken, uniq('multiadmin').toLowerCase());
    const crId = prop.body.data.changeRequest.publicId;
    const snap = prop.body.data.changeRequest.requiredApprovers.map(String);
    expect(snap.sort()).toEqual([bId, cId].sort());
    expect(snap).not.toContain(aId);

    // One of two approvals is not enough.
    const first = await request(app)
      .post(`/api/v1/change-requests/${crId}/approve`)
      .set(authHeader(B.accessToken))
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.data.changeRequest.status).toBe('PENDING');

    // Unanimity completes it.
    const second = await request(app)
      .post(`/api/v1/change-requests/${crId}/approve`)
      .set(authHeader(C.accessToken))
      .send({});
    expect(second.body.data.changeRequest.status).toBe('APPROVED');
    expect(second.body.data.entity.role).toBe('admin');
  });

  // G. Inactive partners cannot decide (fail closed at every layer).
  it('G: a deactivated partner loses decision power (fail closed)', async () => {
    const prop = await proposeAdminCreation(A.accessToken, uniq('inactiveappr').toLowerCase());
    const crId = prop.body.data.changeRequest.publicId;

    // Case 1: linked partner record deactivated (login still active) ->
    // blocked at the decision gate.
    const deactRec = await request(app)
      .put(`/api/v1/partners/${B.partnerPublicId}`)
      .set(authHeader(adminToken))
      .send({ isActive: false });
    expect(deactRec.status).toBe(200);
    const attempt = await request(app)
      .post(`/api/v1/change-requests/${crId}/approve`)
      .set(authHeader(B.accessToken))
      .send({});
    expect(attempt.status).toBe(403);
    const reactRec = await request(app)
      .put(`/api/v1/partners/${B.partnerPublicId}`)
      .set(authHeader(adminToken))
      .send({ isActive: true });
    expect(reactRec.status).toBe(200);

    // Case 2: login itself deactivated -> rejected at authentication.
    const deactUser = await request(app)
      .patch(`/api/v1/users/${B.userPublicId}/active`)
      .set(authHeader(adminToken))
      .send({ isActive: false });
    expect(deactUser.status).toBe(200);
    const attempt2 = await request(app)
      .post(`/api/v1/change-requests/${crId}/approve`)
      .set(authHeader(B.accessToken))
      .send({});
    expect(attempt2.status).toBe(401);

    // Request untouched by either attempt; restore B for a clean file end.
    const still = await request(app).get(`/api/v1/change-requests/${crId}`).set(authHeader(adminToken));
    expect(still.body.data.status).toBe('PENDING');
    const reactivate = await request(app)
      .patch(`/api/v1/users/${B.userPublicId}/active`)
      .set(authHeader(adminToken))
      .send({ isActive: true });
    expect(reactivate.status).toBe(200);
  });

  // K. Developer behavior unchanged: direct apply, no request.
  it('K: developer direct user management still applies immediately', async () => {
    const dev = await setupDeveloper();
    const prec = await request(app)
      .post('/api/v1/partners')
      .set(authHeader(adminToken))
      .send({ name: uniq('DevRec') });
    expect(prec.status).toBe(201);
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(dev.accessToken))
      .send({
        username: uniq('devdirect').toLowerCase(),
        password: 'Test@1234',
        fullName: 'Dev Direct',
        role: 'partner',
        partnerPublicId: prec.body.data.entity.publicId,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.changeRequest).toBeNull();
    expect(res.body.data.entity.username).toBeTruthy();
  });

  // Identity flags: every viewer gets server-derived requester/decision
  // state, and the user directory exposes the numeric id needed to resolve
  // requester names (no more perpetual "#id" fallbacks).
  it('L: rows carry viewerIsRequester per viewer; directory exposes ids', async () => {
    const prop = await proposeAdminCreation(A.accessToken, uniq('idflags').toLowerCase());
    const crId = prop.body.data.changeRequest.publicId;
    const aId = String(await userIdByUsername(A.username));

    const asA = await request(app).get(`/api/v1/change-requests/${crId}`).set(authHeader(A.accessToken));
    expect(String(asA.body.data.requestedBy)).toBe(aId);
    expect(asA.body.data.viewerIsRequester).toBe(true);
    expect(asA.body.data.viewerCanDecide).toBe(false);

    const asB = await request(app).get(`/api/v1/change-requests/${crId}`).set(authHeader(B.accessToken));
    expect(asB.body.data.viewerIsRequester).toBe(false);
    expect(asB.body.data.viewerCanDecide).toBe(true);

    const asAdmin = await request(app).get(`/api/v1/change-requests/${crId}`).set(authHeader(adminToken));
    expect(asAdmin.body.data.viewerIsRequester).toBe(false);
    expect(asAdmin.body.data.viewerCanDecide).toBe(false);

    const list = await request(app)
      .get('/api/v1/change-requests')
      .query({ status: 'PENDING', entityType: 'user' })
      .set(authHeader(B.accessToken));
    const row = list.body.data.rows.find((r) => r.publicId === crId);
    expect(row.viewerIsRequester).toBe(false);
    expect(row.viewerCanDecide).toBe(true);

    const users = await request(app)
      .get('/api/v1/users')
      .query({ search: A.username, limit: 5 })
      .set(authHeader(adminToken));
    const me = users.body.data.rows.find((u) => u.username === A.username);
    expect(String(me.id)).toBe(aId);
  });
});
