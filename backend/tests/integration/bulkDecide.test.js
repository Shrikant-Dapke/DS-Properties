import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import {
  getAdminToken,
  authHeader,
  setupPartner,
  setupPartnerQuorum,
} from '../helpers/api.js';

function uniq(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// Bulk approve/reject (Approve All / Reject All UX): every item flows through
// the standard single-item approve/reject path, so snapshot membership,
// self-approval prevention, admin exclusion, inactive-partner rejection,
// exactly-once execution, and auditing all behave exactly as they do for
// individual decisions. Failures are per-item; successes are never rolled back.
describe('Bulk approve/reject (Approve All / Reject All)', () => {
  let adminToken;
  let A;
  let B;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    [A, B] = await setupPartnerQuorum(adminToken, 2, 'bulk');
  });

  async function proposeAdminCreation(proposerToken, username) {
    return request(app)
      .post('/api/v1/users')
      .set(authHeader(proposerToken))
      .send({ username, password: 'Test@1234', fullName: 'Proposed Admin', role: 'admin' });
  }

  async function proposeOne(proposerToken, tag) {
    const username = uniq(tag).toLowerCase();
    const prop = await proposeAdminCreation(proposerToken, username);
    expect(prop.status).toBe(201);
    expect(prop.body.data.changeRequest.status).toBe('PENDING');
    return { username, crId: prop.body.data.changeRequest.publicId };
  }

  async function userExists(username) {
    const r = await pool.query('SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL', [username]);
    return r.rows.length > 0;
  }

  async function auditsFor(recordId) {
    const r = await pool.query('SELECT action, domain FROM audit_logs WHERE record_id = $1 ORDER BY id', [recordId]);
    return r.rows.map((a) => `${a.domain}:${a.action}`);
  }

  it('bulk approve processes every actionable request exactly once with audits', async () => {
    const first = await proposeOne(A.accessToken, 'bulkappr1');
    const second = await proposeOne(A.accessToken, 'bulkappr2');
    const third = await proposeOne(A.accessToken, 'bulkappr3');

    const res = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(B.accessToken))
      .send({ publicIds: [first.crId, second.crId, third.crId] });
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('approve');
    expect(res.body.data.succeeded).toBe(3);
    expect(res.body.data.failed).toBe(0);
    for (const item of res.body.data.results) {
      expect(item.ok).toBe(true);
      expect(item.status).toBe('APPROVED');
    }

    // Each operation applied exactly once.
    for (const { username } of [first, second, third]) {
      expect(await userExists(username)).toBe(true);
    }

    // Standard approval audits were recorded for every item.
    for (const { crId } of [first, second, third]) {
      expect(await auditsFor(crId)).toContain('governance:change_request_approve');
    }

    // Re-running decides nothing new.
    const again = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(B.accessToken))
      .send({ publicIds: [first.crId, second.crId, third.crId] });
    expect(again.body.data.succeeded).toBe(0);
    expect(again.body.data.failed).toBe(3);
  });

  it('bulk reject rejects every actionable request without applying', async () => {
    const first = await proposeOne(A.accessToken, 'bulkrej1');
    const second = await proposeOne(A.accessToken, 'bulkrej2');

    const res = await request(app)
      .post('/api/v1/change-requests/bulk-reject')
      .set(authHeader(B.accessToken))
      .send({ publicIds: [first.crId, second.crId] });
    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(2);
    expect(res.body.data.failed).toBe(0);

    expect(await userExists(first.username)).toBe(false);
    expect(await userExists(second.username)).toBe(false);
    expect(await auditsFor(first.crId)).toContain('governance:change_request_reject');
  });

  it('requester cannot bulk approve their own requests', async () => {
    const first = await proposeOne(A.accessToken, 'bulkself1');
    const second = await proposeOne(A.accessToken, 'bulkself2');

    const res = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(A.accessToken))
      .send({ publicIds: [first.crId, second.crId] });
    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(0);
    expect(res.body.data.failed).toBe(2);
    for (const item of res.body.data.results) {
      expect(item.ok).toBe(false);
      expect(item.code).toBe('FORBIDDEN');
    }

    const still = await request(app).get(`/api/v1/change-requests/${first.crId}`).set(authHeader(B.accessToken));
    expect(still.body.data.status).toBe('PENDING');
  });

  it('admin cannot bulk approve partner-governed requests', async () => {
    const { crId } = await proposeOne(A.accessToken, 'bulkadmin1');

    const res = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(adminToken))
      .send({ publicIds: [crId] });
    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(0);
    expect(res.body.data.failed).toBe(1);
    expect(res.body.data.results[0].code).toBe('FORBIDDEN');
  });

  it('inactive partner cannot bulk decide', async () => {
    const { crId } = await proposeOne(A.accessToken, 'bulkinact1');

    // Linked partner record deactivated (login still active): per-item 403.
    const deactRec = await request(app)
      .put(`/api/v1/partners/${B.partnerPublicId}`)
      .set(authHeader(adminToken))
      .send({ isActive: false });
    expect(deactRec.status).toBe(200);
    const attempt = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(B.accessToken))
      .send({ publicIds: [crId] });
    expect(attempt.status).toBe(200);
    expect(attempt.body.data.succeeded).toBe(0);
    expect(attempt.body.data.results[0].code).toBe('FORBIDDEN');
    const reactRec = await request(app)
      .put(`/api/v1/partners/${B.partnerPublicId}`)
      .set(authHeader(adminToken))
      .send({ isActive: true });
    expect(reactRec.status).toBe(200);

    // Login itself deactivated: rejected at authentication.
    const deactUser = await request(app)
      .patch(`/api/v1/users/${B.userPublicId}/active`)
      .set(authHeader(adminToken))
      .send({ isActive: false });
    expect(deactUser.status).toBe(200);
    const attempt2 = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(B.accessToken))
      .send({ publicIds: [crId] });
    expect(attempt2.status).toBe(401);
    const reactivate = await request(app)
      .patch(`/api/v1/users/${B.userPublicId}/active`)
      .set(authHeader(adminToken))
      .send({ isActive: true });
    expect(reactivate.status).toBe(200);

    const still = await request(app).get(`/api/v1/change-requests/${crId}`).set(authHeader(B.accessToken));
    expect(still.body.data.status).toBe('PENDING');
  });

  it('already-decided requests fail safely while the rest succeed (partial)', async () => {
    const first = await proposeOne(A.accessToken, 'bulkstale1');
    const second = await proposeOne(A.accessToken, 'bulkstale2');

    const single = await request(app)
      .post(`/api/v1/change-requests/${first.crId}/approve`)
      .set(authHeader(B.accessToken))
      .send({});
    expect(single.body.data.changeRequest.status).toBe('APPROVED');

    const res = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(B.accessToken))
      .send({ publicIds: [first.crId, second.crId] });
    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(1);
    expect(res.body.data.failed).toBe(1);
    const byId = Object.fromEntries(res.body.data.results.map((r) => [r.publicId, r]));
    expect(byId[first.crId].ok).toBe(false);
    expect(byId[first.crId].code).toBe('ALREADY_RESOLVED');
    expect(byId[second.crId].ok).toBe(true);

    // The first request was applied exactly once, not twice.
    const dup = await pool.query('SELECT count(*)::int AS n FROM users WHERE username = $1', [first.username]);
    expect(dup.rows[0].n).toBe(1);
  });

  it('unknown ids are reported while valid ones still process', async () => {
    const { crId } = await proposeOne(A.accessToken, 'bulkunknown1');
    const missing = '11111111-1111-4111-8111-111111111111';

    const res = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(B.accessToken))
      .send({ publicIds: [crId, missing] });
    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(1);
    expect(res.body.data.failed).toBe(1);
    const byId = Object.fromEntries(res.body.data.results.map((r) => [r.publicId, r]));
    expect(byId[crId].ok).toBe(true);
    expect(byId[missing].ok).toBe(false);
    expect(byId[missing].code).toBe('NOT_FOUND');
  });

  it('rejects invalid bulk payloads', async () => {
    const bad = [
      {},
      { publicIds: [] },
      { publicIds: ['not-a-uuid'] },
      { publicIds: Array.from({ length: 101 }, () => '11111111-1111-4111-8111-111111111111') },
    ];
    for (const body of bad) {
      const res = await request(app)
        .post('/api/v1/change-requests/bulk-approve')
        .set(authHeader(B.accessToken))
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('duplicate decision inside a pending quorum fails per item', async () => {
    const C = await setupPartner(adminToken, 'bulk3');
    const { crId } = await proposeOne(A.accessToken, 'bulkdup1');

    // With three active partners the snapshot needs B and C; B alone leaves it PENDING.
    const single = await request(app)
      .post(`/api/v1/change-requests/${crId}/approve`)
      .set(authHeader(B.accessToken))
      .send({});
    expect(single.body.data.changeRequest.status).toBe('PENDING');

    const res = await request(app)
      .post('/api/v1/change-requests/bulk-approve')
      .set(authHeader(B.accessToken))
      .send({ publicIds: [crId] });
    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(0);
    expect(res.body.data.results[0].code).toBe('DUPLICATE_APPROVAL');

    // C can still complete it through the normal path.
    const fin = await request(app)
      .post(`/api/v1/change-requests/${crId}/approve`)
      .set(authHeader(C.accessToken))
      .send({});
    expect(fin.body.data.changeRequest.status).toBe('APPROVED');
  });
});
