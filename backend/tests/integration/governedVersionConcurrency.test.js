import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import {
  getAdminToken,
  authHeader,
  setupPartnerQuorum,
  setupDeveloper,
  proposeAsPartner,
  approveAsPartners,
  proposeAndApprove,
} from '../helpers/api.js';
import {
  updateCustomerSchema,
} from '../../src/validators/customerValidators.js';
import {
  updatePartnerSchema,
} from '../../src/validators/partnerValidators.js';
import {
  updateCategorySchema,
} from '../../src/validators/categoryValidators.js';

function uniq(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Governed-entity optimistic concurrency (customer/partner/category versionTag)', () => {
  let adminToken;
  let Q;
  let dev;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    Q = await setupPartnerQuorum(adminToken, 2, 'ver');
    dev = await setupDeveloper();
  });

  async function createCustomerDirect(name) {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(authHeader(dev.accessToken))
      .send({ name });
    expect(res.status).toBe(201);
    return res.body.data.entity;
  }

  async function createCategoryDirect(name) {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.floor(Math.random() * 1e6)}`;
    const res = await request(app)
      .post('/api/v1/categories')
      .set(authHeader(dev.accessToken))
      .send({ name, slug });
    expect(res.status).toBe(201);
    return res.body.data.entity;
  }

  async function createPartnerDirect(name) {
    const res = await request(app)
      .post('/api/v1/partners')
      .set(authHeader(adminToken))
      .send({ name });
    expect(res.status).toBe(201);
    return res.body.data.entity;
  }

  // ---- API source: versionTag is exposed and derived from updatedAt ----
  it('GET exposes a real versionTag derived from updatedAt for all three entities', async () => {
    const c = await createCustomerDirect(uniq('VSrcCust'));
    const p = await createPartnerDirect(uniq('VSrcPart'));
    const g = await createCategoryDirect(uniq('VSrcCat'));

    const cg = await request(app).get(`/api/v1/customers/${c.publicId}`).set(authHeader(adminToken));
    expect(cg.status).toBe(200);
    expect(cg.body.data.versionTag).toBeTruthy();
    expect(String(cg.body.data.versionTag)).toBe(String(cg.body.data.updatedAt));

    const pg = await request(app).get(`/api/v1/partners/${p.publicId}`).set(authHeader(adminToken));
    expect(pg.status).toBe(200);
    expect(pg.body.data.versionTag).toBeTruthy();
    expect(String(pg.body.data.versionTag)).toBe(String(pg.body.data.updatedAt));

    const gg = await request(app).get(`/api/v1/categories/${g.publicId}`).set(authHeader(adminToken));
    expect(gg.status).toBe(200);
    expect(gg.body.data.versionTag).toBeTruthy();
    expect(String(gg.body.data.versionTag)).toBe(String(gg.body.data.updatedAt));
  });

  // ---- Case 3: validation preserves versionTag/expectedVersion ----
  it('update Joi schemas preserve versionTag/expectedVersion (not stripped)', async () => {
    for (const [schema, body] of [
      [updateCustomerSchema, { name: 'x', versionTag: '1970-01-01T00:00:00.000Z' }],
      [updatePartnerSchema, { name: 'x', versionTag: '1970-01-01T00:00:00.000Z' }],
      [updateCategorySchema, { name: 'x', versionTag: '1970-01-01T00:00:00.000Z' }],
      [updateCustomerSchema, { name: 'x', expectedVersion: '1970-01-01T00:00:00.000Z' }],
      [updatePartnerSchema, { name: 'x', expectedVersion: '1970-01-01T00:00:00.000Z' }],
      [updateCategorySchema, { name: 'x', expectedVersion: '1970-01-01T00:00:00.000Z' }],
    ]) {
      const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true, convert: true });
      expect(error).toBeUndefined();
      expect(value.versionTag ?? value.expectedVersion).toBe('1970-01-01T00:00:00.000Z');
    }
  });

  // ---- Case 1: normal update with fresh tag succeeds ----
  it('normal update with the fresh versionTag succeeds (customer/partner/category)', async () => {
    const c = await createCustomerDirect(uniq('VNormCust'));
    const gotC = await request(app).get(`/api/v1/customers/${c.publicId}`).set(authHeader(adminToken));
    const resC = await request(app)
      .put(`/api/v1/customers/${c.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ notes: 'fresh-ok', versionTag: gotC.body.data.versionTag });
    expect(resC.status).toBe(200);
    expect(resC.body.data.entity.notes).toBe('fresh-ok');

    const p = await createPartnerDirect(uniq('VNormPart'));
    const gotP = await request(app).get(`/api/v1/partners/${p.publicId}`).set(authHeader(adminToken));
    const resP = await request(app)
      .put(`/api/v1/partners/${p.publicId}`)
      .set(authHeader(adminToken))
      .send({ notes: 'fresh-ok', versionTag: gotP.body.data.versionTag });
    expect(resP.status).toBe(200);
    expect(resP.body.data.entity.notes).toBe('fresh-ok');

    const g = await createCategoryDirect(uniq('VNormCat'));
    const gotG = await request(app).get(`/api/v1/categories/${g.publicId}`).set(authHeader(adminToken));
    const resG = await request(app)
      .put(`/api/v1/categories/${g.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ description: 'fresh-ok', versionTag: gotG.body.data.versionTag });
    expect(resG.status).toBe(200);
    expect(resG.body.data.entity.description).toBe('fresh-ok');
  });

  it('expectedVersion alias is honored as a concurrency tag', async () => {
    const c = await createCustomerDirect(uniq('VAliasCust'));
    const got = await request(app).get(`/api/v1/customers/${c.publicId}`).set(authHeader(adminToken));
    const stale = await request(app)
      .put(`/api/v1/customers/${c.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ notes: 'stale-alias', expectedVersion: '1970-01-01T00:00:00.000Z' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_CONFLICT');
    const fresh = await request(app)
      .put(`/api/v1/customers/${c.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ notes: 'fresh-alias', expectedVersion: got.body.data.versionTag });
    expect(fresh.status).toBe(200);
  });

  // ---- Case 2: stale update rejected deterministically ----
  it('stale update is rejected with STALE_CONFLICT (customer/partner/category)', async () => {
    const c = await createCustomerDirect(uniq('VStaleCust'));
    const resC = await request(app)
      .put(`/api/v1/customers/${c.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ notes: 'stale', versionTag: '1970-01-01T00:00:00.000Z' });
    expect(resC.status).toBe(409);
    expect(resC.body.error.code).toBe('STALE_CONFLICT');

    const p = await createPartnerDirect(uniq('VStalePart'));
    const resP = await request(app)
      .put(`/api/v1/partners/${p.publicId}`)
      .set(authHeader(adminToken))
      .send({ notes: 'stale', versionTag: '1970-01-01T00:00:00.000Z' });
    expect(resP.status).toBe(409);
    expect(resP.body.error.code).toBe('STALE_CONFLICT');

    const g = await createCategoryDirect(uniq('VStaleCat'));
    const resG = await request(app)
      .put(`/api/v1/categories/${g.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ description: 'stale', versionTag: '1970-01-01T00:00:00.000Z' });
    expect(resG.status).toBe(409);
    expect(resG.body.error.code).toBe('STALE_CONFLICT');
  });

  it('read-modify-write race on the direct path rejects the loser', async () => {
    const c = await createCustomerDirect(uniq('VRaceCust'));
    const t1 = (await request(app).get(`/api/v1/customers/${c.publicId}`).set(authHeader(adminToken))).body.data.versionTag;
    await sleep(20);
    // Winner moves the row first.
    const win = await request(app)
      .put(`/api/v1/customers/${c.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ notes: 'winner', versionTag: t1 });
    expect(win.status).toBe(200);
    // Loser retries with the now-stale T1 tag.
    const lose = await request(app)
      .put(`/api/v1/customers/${c.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ notes: 'loser', versionTag: t1 });
    expect(lose.status).toBe(409);
    expect(lose.body.error.code).toBe('STALE_CONFLICT');
  });

  // ---- Case 4: SQL/update safety — tag never becomes a column ----
  it('versionTag is never written as a database column', async () => {
    const c = await createCustomerDirect(uniq('VSqlCust'));
    const got = await request(app).get(`/api/v1/customers/${c.publicId}`).set(authHeader(adminToken));
    const res = await request(app)
      .put(`/api/v1/customers/${c.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ notes: 'sql-safe', versionTag: got.body.data.versionTag });
    expect(res.status).toBe(200);
    const row = await pool.query('SELECT * FROM customers WHERE public_id = $1', [c.publicId]);
    expect(row.rows[0]).toBeTruthy();
    expect('versionTag' in row.rows[0]).toBe(false);
    expect('version_tag' in row.rows[0]).toBe(false);
    expect('expectedVersion' in row.rows[0]).toBe(false);
    expect('expectedversion' in Object.fromEntries(Object.keys(row.rows[0]).map((k) => [k.toLowerCase(), true]))).toBe(false);

    const p = await createPartnerDirect(uniq('VSqlPart'));
    const gotP = await request(app).get(`/api/v1/partners/${p.publicId}`).set(authHeader(adminToken));
    const resP = await request(app)
      .put(`/api/v1/partners/${p.publicId}`)
      .set(authHeader(adminToken))
      .send({ notes: 'sql-safe', versionTag: gotP.body.data.versionTag });
    expect(resP.status).toBe(200);
    const prow = await pool.query('SELECT * FROM partners WHERE public_id = $1', [p.publicId]);
    expect('versionTag' in prow.rows[0]).toBe(false);
    expect('version_tag' in prow.rows[0]).toBe(false);

    const g = await createCategoryDirect(uniq('VSqlCat'));
    const gotG = await request(app).get(`/api/v1/categories/${g.publicId}`).set(authHeader(adminToken));
    const resG = await request(app)
      .put(`/api/v1/categories/${g.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ description: 'sql-safe', versionTag: gotG.body.data.versionTag });
    expect(resG.status).toBe(200);
    const grow = await pool.query('SELECT * FROM expense_categories WHERE public_id = $1', [g.publicId]);
    expect('versionTag' in grow.rows[0]).toBe(false);
    expect('version_tag' in grow.rows[0]).toBe(false);
  });

  // ---- Case 5: governance — tag survives propose → approve ----
  it('partner-proposed customer update carries the tag through governance', async () => {
    const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/customers', { name: uniq('VGovCust') });
    const got = await request(app).get(`/api/v1/customers/${entity.publicId}`).set(authHeader(Q[0].accessToken));
    const freshTag = got.body.data.versionTag;
    expect(freshTag).toBeTruthy();

    // Stale proposal fails fast with no request created.
    const stale = await proposeAsPartner(Q[0], 'put', `/api/v1/customers/${entity.publicId}`, {
      notes: 'stale-gov',
      versionTag: '1970-01-01T00:00:00.000Z',
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_CONFLICT');

    // Fresh proposal becomes PENDING and applies on unanimous approval.
    const prop = await proposeAsPartner(Q[0], 'put', `/api/v1/customers/${entity.publicId}`, {
      notes: 'gov-ok',
      versionTag: freshTag,
    });
    expect(prop.status).toBe(200);
    expect(prop.body.data.changeRequest.status).toBe('PENDING');
    expect(prop.body.data.changeRequest.versionTag).toBeTruthy();
    const fin = await approveAsPartners(prop.body.data.changeRequest.publicId, Q.slice(1));
    expect(fin.body.data.changeRequest.status).toBe('APPROVED');
    expect(fin.body.data.entity.notes).toBe('gov-ok');
  });

  it('partner-proposed category update carries the tag through governance', async () => {
    const slug = `vgovcat-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/categories', { name: uniq('VGovCat'), slug });
    const got = await request(app).get(`/api/v1/categories/${entity.publicId}`).set(authHeader(Q[0].accessToken));
    const freshTag = got.body.data.versionTag;
    expect(freshTag).toBeTruthy();

    const stale = await proposeAsPartner(Q[0], 'put', `/api/v1/categories/${entity.publicId}`, {
      description: 'stale-gov',
      versionTag: '1970-01-01T00:00:00.000Z',
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_CONFLICT');

    const prop = await proposeAsPartner(Q[0], 'put', `/api/v1/categories/${entity.publicId}`, {
      description: 'gov-ok',
      versionTag: freshTag,
    });
    expect(prop.status).toBe(200);
    expect(prop.body.data.changeRequest.status).toBe('PENDING');
    const fin = await approveAsPartners(prop.body.data.changeRequest.publicId, Q.slice(1));
    expect(fin.body.data.changeRequest.status).toBe('APPROVED');
    expect(fin.body.data.entity.description).toBe('gov-ok');
  });

  it('governed update proposed before a concurrent move is CANCELLED as STALE_CONFLICT on approve', async () => {
    const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/customers', { name: uniq('VGovRace') });
    const t1 = (await request(app).get(`/api/v1/customers/${entity.publicId}`).set(authHeader(Q[0].accessToken))).body.data.versionTag;
    const e1 = await proposeAsPartner(Q[0], 'put', `/api/v1/customers/${entity.publicId}`, {
      notes: 'E1-stale',
      versionTag: t1,
    });
    expect(e1.body.data.changeRequest.status).toBe('PENDING');
    const cr1 = e1.body.data.changeRequest.publicId;
    await sleep(20);
    // Concurrent winner applies directly (developer bypass) and moves the row.
    const win = await request(app)
      .put(`/api/v1/customers/${entity.publicId}`)
      .set(authHeader(dev.accessToken))
      .send({ notes: 'E2-wins', versionTag: t1 });
    expect(win.status).toBe(200);
    // Approving the now-stale E1 must CANCEL, never overwrite.
    const fin = await approveAsPartners(cr1, Q.slice(1));
    expect(fin.body.data.changeRequest.status).toBe('CANCELLED');
    expect(fin.body.data.changeRequest.resolutionReason).toBe('STALE_CONFLICT');
    const got = await request(app).get(`/api/v1/customers/${entity.publicId}`).set(authHeader(adminToken));
    expect(got.body.data.notes).toBe('E2-wins');
  });
});
