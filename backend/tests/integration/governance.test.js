import request from 'supertest';
import app from '../../src/app.js';
import { getAdminToken, authHeader, login, setupViewer, setupSecondAdmin } from '../helpers/api.js';

describe('Access control & governance', () => {
  let adminToken;
  let viewer;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    viewer = await setupViewer();
  });

  async function deleteUser(publicId) {
    await request(app).delete(`/api/v1/users/${publicId}`).set(authHeader(adminToken));
  }

  // Approve a change request with one token per required approver. The first two
  // approvers are always the seeded admin (adminToken) and the persistent
  // second admin; callers pass any extra tokens (e.g. the target admin's).
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

    it('accepts admin and read_only roles', async () => {
      const a = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `a_${Date.now()}`, password: 'Test@1234', fullName: 'A', role: 'admin' });
      expect(a.status).toBe(201);
      const aId = a.body.data.entity.publicId;
      const r = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `ro_${Date.now()}`, password: 'Test@1234', fullName: 'RO', role: 'read_only' });
      expect(r.status).toBe(201);
      const rId = r.body.data.entity.publicId;
      await deleteUser(aId);
      await deleteUser(rId);
    });
  });

  describe('read_only cannot mutate', () => {
    it('cannot create a customer', async () => {
      const vToken = (await login(viewer.username, viewer.password)).accessToken;
      const res = await request(app)
        .post('/api/v1/customers')
        .set(authHeader(vToken))
        .send({ name: 'X' });
      expect(res.status).toBe(403);
    });

    it('cannot reach approval APIs', async () => {
      const vToken = (await login(viewer.username, viewer.password)).accessToken;
      const list = await request(app).get('/api/v1/change-requests').set(authHeader(vToken));
      expect(list.status).toBe(403);
      const approve = await request(app)
        .post('/api/v1/change-requests/00000000-0000-0000-0000-000000000000/approve')
        .set(authHeader(vToken))
        .send({});
      expect(approve.status).toBe(403);
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

    it('creating a read_only user is a direct admin action (no change request)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `rodir_${Date.now()}`, password: 'Test@1234', fullName: 'RO', role: 'read_only' });
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
      await deleteUser(resolved.entity.publicId);
    });

    it('promoting a read_only user to admin is governed', async () => {
      const a2 = await approver();
      const ro = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `prom_${Date.now()}`, password: 'Test@1234', fullName: 'P', role: 'read_only' });
      const roId = ro.body.data.entity.publicId;
      const res = await request(app)
        .put(`/api/v1/users/${roId}`)
        .set(authHeader(adminToken))
        .send({ role: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      const resolved = await approveAll(res.body.data.changeRequest.publicId, [a2.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      await deleteUser(resolved.entity.publicId);
    });

    it('demoting an admin to read_only is governed', async () => {
      const a2 = await approver();
      const target = await freshAdmin();
      const res = await request(app)
        .put(`/api/v1/users/${target.publicId}`)
        .set(authHeader(adminToken))
        .send({ role: 'read_only' });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      const resolved = await approveAll(res.body.data.changeRequest.publicId, [a2.accessToken, target.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
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
      const resolved = await approveAll(res.body.data.changeRequest.publicId, [a2.accessToken, target.accessToken]);
      expect(resolved.changeRequest.status).toBe('APPROVED');
      await deleteUser(resolved.entity.publicId);
    });

    it('deactivating a read_only user is a direct admin action', async () => {
      const ro = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `rodeact_${Date.now()}`, password: 'Test@1234', fullName: 'RO', role: 'read_only' });
      const res = await request(app)
        .patch(`/api/v1/users/${ro.body.data.entity.publicId}/active`)
        .set(authHeader(adminToken))
        .send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest).toBeNull();
      await deleteUser(ro.body.data.entity.publicId);
    });

    it('resetting a password is a direct admin action (never governed)', async () => {
      const ro = await request(app)
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({ username: `ropw_${Date.now()}`, password: 'Test@1234', fullName: 'RO', role: 'read_only' });
      const res = await request(app)
        .post(`/api/v1/users/${ro.body.data.entity.publicId}/reset-password`)
        .set(authHeader(adminToken))
        .send({ newPassword: 'NewPass@99' });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest).toBeNull();
      await deleteUser(ro.body.data.entity.publicId);
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
      await deleteUser(resolved.entity.publicId);
      await deleteUser(thirdResolved.entity.publicId);
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
      await deleteUser(resolved.entity.publicId);
    });
  });
});
