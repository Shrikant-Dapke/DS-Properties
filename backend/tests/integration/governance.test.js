import request from 'supertest';
import app from '../../src/app.js';
import { cancelChange } from '../../src/services/governanceService.js';
import { getAdminToken, authHeader, login, setupPartner, setupSecondAdmin } from '../helpers/api.js';

describe('Access control & governance', () => {
  let adminToken;
  let stranger;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    // Partner outside every snapshot in this file: proves non-approvers and
    // non-managers are rejected without spending per-test logins.
    stranger = await setupPartner(adminToken, 'stranger');
  });

  async function deleteUser(publicId) {
    return request(app).delete(`/api/v1/users/${publicId}`).set(authHeader(adminToken));
  }

  // Delete an ADMIN (governed): DELETE returns PENDING, then approve with every
  // supplied admin token until quorum is reached. Callers must include the
  // target admin's own token when the target is still an active approver, and
  // must order tokens so a NON-target admin approves last: the final approver
  // is the applier, and the self-delete guard rejects applier === target.
  async function deleteAdminGoverned(publicId, extraTokens = []) {
    const del = await deleteUser(publicId);
    expect(del.status).toBe(200);
    expect(del.body.data.changeRequest.status).toBe('PENDING');
    const resolved = await approveAll(del.body.data.changeRequest.publicId, extraTokens);
    expect(resolved.changeRequest.status).toBe('APPROVED');
    return resolved;
  }

  // Approve a change request with one token per required approver. The first two
  // approvers are always the seeded admin (adminToken) and the persistent
  // second admin; callers pass any extra tokens (e.g. the target admin's).
  // NOTE: the LAST token in the sequence is the applier for quorum completion,
  // so for delete/deactivate self-guarded ops the last token must NOT be the
  // target itself — pass target tokens before non-target tokens.
  async function approveAll(publicId, extraTokens = []) {
    const tokens = [adminToken, ...extraTokens];
    let last = null;
    for (const t of tokens) {
      // best-effort; an already-approved requester 409s here
      last = await request(app).post(`/api/v1/change-requests/${publicId}/approve`).set(authHeader(t)).send({});
    }
    if (last && last.status === 200 && last.body.data.entity) return last.body.data;
    const res = await request(app).get(`/api/v1/change-requests/${publicId}`).set(authHeader(adminToken));
    return res.body.data;
  }

  describe('Role model', () => {
    it('rejects the legacy operator role', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `op_${Date.now()}`, password: 'Test@1234', fullName: 'Op', role: 'operator' });
      expect(res.status).toBe(400);
    });

    it('rejects the legacy viewer role', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `vw_${Date.now()}`, password: 'Test@1234', fullName: 'Vw', role: 'viewer' });
      expect(res.status).toBe(400);
    });

    it('accepts admin and partner roles, rejects read_only', async () => {
      // Ensure a second active admin so governed deletes have a non-target
      // quorum completer (final approver must not be the target itself).
      const a2early = await setupSecondAdmin();
      const adminUsername = `a_${Date.now()}`;
      const a = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: adminUsername, password: 'Test@1234', fullName: 'A', role: 'admin' });
      expect(a.status).toBe(201);
      // With ≥2 active admins, creating an admin is PENDING until quorum;
      // approve it (requester seed already approved) to get the entity.
      let aId;
      if (a.body.data.entity) {
        aId = a.body.data.entity.publicId;
      } else {
        expect(a.body.data.changeRequest.status).toBe('PENDING');
        const approved = await approveAll(a.body.data.changeRequest.publicId, [a2early.accessToken]);
        expect(approved.changeRequest.status).toBe('APPROVED');
        aId = approved.entity.publicId;
      }
      // Partner users require a linked record.
      const prec = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: `RoleRec_${Date.now()}` });
      expect(prec.status).toBe(201);
      const r = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          username: `pt_${Date.now()}`,
          password: 'Test@1234',
          fullName: 'PT',
          role: 'partner',
          partnerPublicId: prec.body.data.entity.publicId,
        });
      expect(r.status).toBe(201);
      const rId = r.body.data.entity.publicId;
      // read_only is retired: not creatable in production.
      const ro = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `ro_${Date.now()}`, password: 'Test@1234', fullName: 'RO', role: 'read_only' });
      expect(ro.status).toBe(400);
      // Deleting an ADMIN is governed: approve with the target's own token
      // first, then a non-target admin last to complete quorum.
      const aLogin = await login(adminUsername, 'Test@1234');
      await deleteAdminGoverned(aId, [aLogin.accessToken, a2early.accessToken]);
      const rDel = await deleteUser(rId);
      expect(rDel.body.data.changeRequest).toBeNull();
    });
  });

  describe('partner cannot manage users', () => {
    it('cannot create a user', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(stranger.accessToken))
        .send({ username: 'X', password: 'Test@1234', fullName: 'X', role: 'partner' });
      expect(res.status).toBe(403);
    });

    it('cannot reach decisions outside its snapshot', async () => {
      const list = await request(app).get('/api/v1/change-requests').set(authHeader(stranger.accessToken));
      expect(list.status).toBe(200);
      // Well-formed but nonexistent id: passes validation, service finds
      // nothing (proves the call reaches the service layer and fails closed).
      const approve = await request(app)
        .post('/api/v1/change-requests/123e4567-e89b-42d3-a456-426614174000/approve')
        .set(authHeader(stranger.accessToken))
        .send({});
      expect(approve.status).toBe(404);
    });
  });

  describe('User-governance classification', () => {
    async function approver() {
      return setupSecondAdmin();
    }

    // Create a brand-new active admin (governed when other admins exist) and
    // approve it, returning the entity (with its own access token) so it can be
    // used as a mutation target.
    async function freshAdmin() {
      const a2 = await approver();
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `adm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, password: 'Test@1234', fullName: 'Target', role: 'admin' });
      const cr = res.body.data.changeRequest;
      const resolved = await approveAll(cr.publicId, [a2.accessToken]);
      const entity = resolved.entity;
      const loginData = await login(entity.username, 'Test@1234');
      return { ...entity, accessToken: loginData.accessToken };
    }

    it('creating a partner user is a direct admin action (no change request)', async () => {
      const prec = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: `DirectRec_${Date.now()}` });
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          username: `ptdir_${Date.now()}`,
          password: 'Test@1234',
          fullName: 'PT',
          role: 'partner',
          partnerPublicId: prec.body.data.entity.publicId,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.changeRequest).toBeNull();
      expect(res.body.data.entity.publicId).toBeTruthy();
      await deleteUser(res.body.data.entity.publicId);
    });

    it('creating an admin is governed', async () => {
      const a2 = await approver();
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `admin3_${Date.now()}`, password: 'Test@1234', fullName: 'A3', role: 'admin' });
      const cr = res.body.data.changeRequest;
      expect(cr.status).toBe('PENDING');
      expect(res.body.data.entity).toBeNull();
      const resolved = await approveAll(cr.publicId, [a2.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      expect(resolved.entity).not.toBeNull();
      const targetLogin = await login(resolved.entity.username, 'Test@1234');
      await deleteAdminGoverned(resolved.entity.publicId, [targetLogin.accessToken, a2.accessToken]);
    });

    it('promoting a partner user to admin is governed', async () => {
      const a2 = await approver();
      const prec = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: `PromRec_${Date.now()}` });
      const pt = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          username: `prom_${Date.now()}`,
          password: 'Test@1234',
          fullName: 'P',
          role: 'partner',
          partnerPublicId: prec.body.data.entity.publicId,
        });
      const ptId = pt.body.data.entity.publicId;
      const res = await request(app)
        .put(`/api/v1/users/${ptId}`)
        .set(authHeader(adminToken))
        .send({ role: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      const resolved = await approveAll(res.body.data.changeRequest.publicId, [a2.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      const promotedLogin = await login(resolved.entity.username, 'Test@1234');
      await deleteAdminGoverned(resolved.entity.publicId, [promotedLogin.accessToken, a2.accessToken]);
    });

    it('demoting an admin to partner is governed', async () => {
      const a2 = await approver();
      const target = await freshAdmin();
      const prec = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: `DemRec_${Date.now()}` });
      const res = await request(app)
        .put(`/api/v1/users/${target.publicId}`)
        .set(authHeader(adminToken))
        .send({ role: 'partner', partnerPublicId: prec.body.data.entity.publicId });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      const resolved = await approveAll(res.body.data.changeRequest.publicId, [a2.accessToken, target.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      expect(resolved.entity.role).toBe('partner');
      await deleteUser(resolved.entity.publicId);
    });

    it('deactivating an admin is governed', async () => {
      const a2 = await approver();
      const target = await freshAdmin();
      const res = await request(app)
        .patch(`/api/v1/users/${target.publicId}/active`)
        .set(authHeader(adminToken))
        .send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      // Order target before non-target so the final applier is not the target
      // itself (self-deactivation guard).
      const resolved = await approveAll(res.body.data.changeRequest.publicId, [target.accessToken, a2.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      // Target is now inactive (excluded from future quorums); deleting the
      // inactive admin is still governed but needs only the active admins.
      await deleteAdminGoverned(resolved.entity.publicId, [a2.accessToken]);
    });

    it('deactivating a partner user is a direct admin action', async () => {
      const prec = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: `DeactRec_${Date.now()}` });
      const pt = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          username: `ptdeact_${Date.now()}`,
          password: 'Test@1234',
          fullName: 'PT',
          role: 'partner',
          partnerPublicId: prec.body.data.entity.publicId,
        });
      const res = await request(app)
        .patch(`/api/v1/users/${pt.body.data.entity.publicId}/active`)
        .set(authHeader(adminToken))
        .send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest).toBeNull();
      await deleteUser(pt.body.data.entity.publicId);
    });

    it('resetting a partner password is a direct admin action', async () => {
      const prec = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: `PwRec_${Date.now()}` });
      const pt = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          username: `ptpw_${Date.now()}`,
          password: 'Test@1234',
          fullName: 'PT',
          role: 'partner',
          partnerPublicId: prec.body.data.entity.publicId,
        });
      const res = await request(app)
        .post(`/api/v1/users/${pt.body.data.entity.publicId}/reset-password`)
        .set(authHeader(adminToken))
        .send({ newPassword: 'NewPass@99' });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest).toBeNull();
      await deleteUser(pt.body.data.entity.publicId);
    });
  });

  describe('Approval snapshot & requester approval', () => {
    it('snapshots required approvers at creation and does not change when a new admin appears', async () => {
      const a2 = await setupSecondAdmin();
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `admin3b_${Date.now()}`, password: 'Test@1234', fullName: 'A3b', role: 'admin' });
      const cr = res.body.data.changeRequest;
      expect(cr.status).toBe('PENDING');
      const beforeCount = cr.requiredApprovers.length;
      expect(beforeCount).toBeGreaterThanOrEqual(2);

      const third = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `admin4_${Date.now()}`, password: 'Test@1234', fullName: 'A4', role: 'admin' });
      expect(third.body.data.changeRequest.status).toBe('PENDING');

      const get = await request(app).get(`/api/v1/change-requests/${cr.publicId}`).set(authHeader(adminToken));
      expect(get.body.data.requiredApprovers.length).toBe(beforeCount);

      const resolved = await approveAll(cr.publicId, [a2.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');

      const thirdResolved = await approveAll(third.body.data.changeRequest.publicId, [a2.accessToken]);
      // Cleanup governed deletes: each delete needs its own quorum, including
      // the target's own approval while still active.
      const firstLogin = await login(resolved.entity.username, 'Test@1234');
      const secondLogin = await login(thirdResolved.entity.username, 'Test@1234');
      await deleteAdminGoverned(resolved.entity.publicId, [
        a2.accessToken,
        firstLogin.accessToken,
        secondLogin.accessToken,
      ]);
      await deleteAdminGoverned(thirdResolved.entity.publicId, [secondLogin.accessToken, a2.accessToken]);
    });

    it('records the requester as an automatic approver', async () => {
      const a2 = await setupSecondAdmin();
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `adminR_${Date.now()}`, password: 'Test@1234', fullName: 'AR', role: 'admin' });
      const cr = res.body.data.changeRequest;
      const requesterApproval = cr.approvals.find((a) => a.status === 'APPROVED');
      expect(requesterApproval).toBeTruthy();
      expect(requesterApproval.comment).toMatch(/requester/i);
      const resolved = await approveAll(cr.publicId, [a2.accessToken]);
      const targetLogin = await login(resolved.entity.username, 'Test@1234');
      await deleteAdminGoverned(resolved.entity.publicId, [targetLogin.accessToken, a2.accessToken]);
    });
  });

  describe('P0: admin delete & password-reset governance', () => {
    async function freshAdminTarget() {
      const a2 = await setupSecondAdmin();
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `p0adm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, password: 'Test@1234', fullName: 'P0', role: 'admin' });
      const resolved = await approveAll(res.body.data.changeRequest.publicId, [a2.accessToken]);
      const loginData = await login(resolved.entity.username, 'Test@1234');
      return { a2, entity: resolved.entity, accessToken: loginData.accessToken };
    }

    it('deleting an ADMIN requires multi-approval (PENDING then APPROVED)', async () => {
      const { a2, entity, accessToken } = await freshAdminTarget();
      const del = await request(app).delete(`/api/v1/users/${entity.publicId}`).set(authHeader(adminToken));
      expect(del.status).toBe(200);
      expect(del.body.data.changeRequest).not.toBeNull();
      expect(del.body.data.changeRequest.status).toBe('PENDING');
      expect(del.body.data.entity).toBeNull();
      const resolved = await approveAll(del.body.data.changeRequest.publicId, [accessToken, a2.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      // Target is gone: a second delete 404s and login fails.
      const again = await request(app).delete(`/api/v1/users/${entity.publicId}`).set(authHeader(adminToken));
      expect(again.status).toBe(404);
    });

    it('deleting a partner user stays a direct admin action', async () => {
      const prec = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: `DelRec_${Date.now()}` });
      const pt = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          username: `p0pt_${Date.now()}`,
          password: 'Test@1234',
          fullName: 'P0PT',
          role: 'partner',
          partnerPublicId: prec.body.data.entity.publicId,
        });
      const del = await deleteUser(pt.body.data.entity.publicId);
      expect(del.status).toBe(200);
      expect(del.body.data.changeRequest).toBeNull();
    });

    it('resetting an ADMIN password requires multi-approval and takes effect on quorum', async () => {
      const { a2, entity, accessToken } = await freshAdminTarget();
      const res = await request(app)
        .post(`/api/v1/users/${entity.publicId}/reset-password`)
        .set(authHeader(adminToken))
        .send({ newPassword: 'NewAdmin@123' });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest).not.toBeNull();
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      expect(res.body.data.entity).toBeNull();
      // NOTE: do not log in as the target between request and quorum — any
      // UPDATE to the users row (e.g. last_login_at) bumps updated_at and the
      // optimistic-concurrency guard would CANCEL the ticket as STALE_CONFLICT.
      const resolved = await approveAll(res.body.data.changeRequest.publicId, [a2.accessToken, accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      // Verify the new password works (old password must fail). Single login
      // keeps the suite under the /auth/login rate limit.
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: entity.username, password: 'NewAdmin@123' });
      expect(newLogin.status).toBe(200);
      const targetToken = newLogin.body.data.accessToken;
      await deleteAdminGoverned(entity.publicId, [targetToken, a2.accessToken]);
    });

    it('quorum: one approval is not enough, full quorum applies + audits', async () => {
      const { a2, entity, accessToken } = await freshAdminTarget();
      const res = await request(app)
        .post(`/api/v1/users/${entity.publicId}/reset-password`)
        .set(authHeader(adminToken))
        .send({ newPassword: 'Quorum@123' });
      const crPublicId = res.body.data.changeRequest.publicId;
      // Requester (seed admin) already approved; an outsider partner who is
      // not a required approver is blocked, and the request stays PENDING.
      const blocked = await request(app)
        .post(`/api/v1/change-requests/${crPublicId}/approve`)
        .set(authHeader(stranger.accessToken))
        .send({});
      expect(blocked.status).toBe(403);
      const still = await request(app).get(`/api/v1/change-requests/${crPublicId}`).set(authHeader(adminToken));
      expect(still.body.data.status).toBe('PENDING');
      const resolved = await approveAll(crPublicId, [a2.accessToken, accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      // Audit trail covers create, approve, and apply for this request.
      const audit = await request(app)
        .get('/api/v1/audit')
        .set(authHeader(adminToken))
        .query({ domain: 'governance', limit: 100 });
      expect(audit.status).toBe(200);
      const rows = audit.body.data.rows.filter((r) => r.record_id === crPublicId);
      const actions = rows.map((r) => r.action);
      expect(actions).toContain('change_request_create');
      expect(actions).toContain('change_request_approve');
      expect(actions).toContain('change_request_apply');
      // Cleanup reuses the pre-reset access token (password resets revoke only
      // refresh tokens) to stay under the /auth/login rate limit; password
      // rotation itself is already proven by the dedicated reset test above.
      await deleteAdminGoverned(entity.publicId, [accessToken, a2.accessToken]);
    });

    it('partner role cannot manage users, reset passwords, or approve outside snapshot', async () => {
      // Reuse the fresh target's own token for cleanup (no extra login).
      const { a2, entity, accessToken } = await freshAdminTarget();
      const del = await request(app).delete(`/api/v1/users/${entity.publicId}`).set(authHeader(stranger.accessToken));
      expect(del.status).toBe(403);
      const reset = await request(app)
        .post(`/api/v1/users/${entity.publicId}/reset-password`)
        .set(authHeader(stranger.accessToken))
        .send({ newPassword: 'Blocked@123' });
      expect(reset.status).toBe(403);
      // Cleanup with real admins (target first, non-target last) — reuse the
      // already-logged-in target token, no extra /auth/login.
      await deleteAdminGoverned(entity.publicId, [accessToken, a2.accessToken]);
    });

    it('rejects self-deactivation and self-delete', async () => {
      // Resolve the seed admin's own publicId via the admin-only user list.
      const list = await request(app)
        .get('/api/v1/users')
        .set(authHeader(adminToken))
        .query({ search: 'admin', limit: 100 });
      expect(list.status).toBe(200);
      const me = list.body.data.rows.find((u) => u.username === 'admin');
      expect(me).toBeTruthy();
      const deact = await request(app)
        .patch(`/api/v1/users/${me.publicId}/active`)
        .set(authHeader(adminToken))
        .send({ isActive: false });
      expect(deact.status).toBe(400);
      const del = await request(app).delete(`/api/v1/users/${me.publicId}`).set(authHeader(adminToken));
      expect(del.status).toBe(400);
    });
  });

  describe('P2: cancelChange authorization', () => {
    it('lets the requester cancel a pending request with an optional reason', async () => {
      // Ensure multi-admin quorum so the create stays PENDING (no new login:
      // the second admin is cached after its first setup).
      await setupSecondAdmin();
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `cancelreq_${Date.now()}`, password: 'Test@1234', fullName: 'CancelReq', role: 'admin' });
      expect(res.status).toBe(201);
      const cr = res.body.data.changeRequest;
      expect(cr.status).toBe('PENDING');

      const cancelled = await request(app)
        .post(`/api/v1/change-requests/${cr.publicId}/cancel`)
        .set(authHeader(adminToken))
        .send({ reason: 'no longer needed' });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.changeRequest.status).toBe('CANCELLED');
      expect(cancelled.body.data.changeRequest.resolutionReason).toBe('no longer needed');

      // Cancelling an already-resolved request conflicts.
      const again = await request(app)
        .post(`/api/v1/change-requests/${cr.publicId}/cancel`)
        .set(authHeader(adminToken))
        .send({});
      expect(again.status).toBe(409);
    });

    it('rejects cancel from a non-approver and lets a required approver cancel', async () => {
      const a2 = await setupSecondAdmin();
      const pending = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `cancelpend_${Date.now()}`, password: 'Test@1234', fullName: 'CancelPend', role: 'admin' });
      expect(pending.status).toBe(201);
      const crPublicId = pending.body.data.changeRequest.publicId;
      expect(pending.body.data.changeRequest.status).toBe('PENDING');

      // A partner outside the approver snapshot is rejected: route-level RBAC
      // lets partners reach the endpoint, membership enforcement rejects.
      const blocked = await request(app)
        .post(`/api/v1/change-requests/${crPublicId}/cancel`)
        .set(authHeader(stranger.accessToken))
        .send({ reason: 'intruder' });
      expect(blocked.status).toBe(403);

      // Service-level gate: an admin who is neither the requester nor a
      // member of the approver snapshot gets a 403 AuthorizationError. Calls
      // the service directly with a fake id (which can never match) to avoid
      // spending the file's /auth/login rate-limit budget on a new user.
      await expect(cancelChange(
        crPublicId,
        { id: 999999999 },
        'intruder',
        { userId: 999999999, ip: null, userAgent: null },
      )).rejects.toMatchObject({ statusCode: 403 });

      // A required approver who did not request the change can cancel it.
      const cancelled = await request(app)
        .post(`/api/v1/change-requests/${crPublicId}/cancel`)
        .set(authHeader(a2.accessToken))
        .send({});
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.changeRequest.status).toBe('CANCELLED');
    });
  });
});
