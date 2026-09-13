import request from 'supertest';
import app from '../../src/app.js';
import { getAdminToken, authHeader, setupPartner, proposeAsPartner } from '../helpers/api.js';

// Edge-case governance states: zero partners (bootstrap) and a single
// partner (empty quorum). Each test gets a fresh database, so the pool here
// contains only what this file creates.
describe('Partner governance edge cases (zero / single partner)', () => {
  let adminToken;
  let S = null; // sole partner from the single-partner test, reused below

  beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  it('bootstrap: with zero partners, an admin can directly create the first partner record', async () => {
    const res = await request(app)
      .post('/api/v1/partners')
      .set(authHeader(adminToken))
      .send({ name: `Bootstrap_${Date.now()}` });
    expect(res.status).toBe(201);
    // Direct admin path: no change request involved.
    expect(res.body.data.changeRequest).toBeNull();
    expect(res.body.data.entity.publicId).toBeTruthy();
  });

  it('single partner: business mutation is rejected with NO_PARTNER_QUORUM, never auto-applied', async () => {
    S = await setupPartner(adminToken, 'solo');
    const res = await proposeAsPartner(S, 'post', '/api/v1/customers', { name: `Solo_${Date.now()}` });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_PARTNER_QUORUM');
    expect(res.body.data?.changeRequest ?? null).toBeNull();

    // Nothing was applied: the customer does not exist.
    const list = await request(app).get('/api/v1/customers').set(authHeader(adminToken));
    expect(list.body.data.rows.some((r) => r.name?.startsWith('Solo_'))).toBe(false);
  });

  it('single partner: a second partner unblocks governance (PENDING then APPROVED)', async () => {
    // S (previous test) is still active, so the pool is {S, S1, S2} and S1
    // needs unanimous approval from both others.
    const S1 = await setupPartner(adminToken, 'soloA');
    const S2 = await setupPartner(adminToken, 'soloB');
    const name = `Pair_${Date.now()}`;
    const res = await proposeAsPartner(S1, 'post', '/api/v1/customers', { name });
    expect(res.status).toBe(201);
    expect(res.body.data.changeRequest.status).toBe('PENDING');
    expect(res.body.data.changeRequest.requiredApprovers).toHaveLength(2);

    const one = await request(app)
      .post(`/api/v1/change-requests/${res.body.data.changeRequest.publicId}/approve`)
      .set(authHeader(S2.accessToken))
      .send({});
    expect(one.body.data.changeRequest.status).toBe('PENDING');

    const two = await request(app)
      .post(`/api/v1/change-requests/${res.body.data.changeRequest.publicId}/approve`)
      .set(authHeader(S.accessToken))
      .send({});
    expect(two.body.data.changeRequest.status).toBe('APPROVED');
    expect(two.body.data.entity.name).toBe(name);
  });
});
