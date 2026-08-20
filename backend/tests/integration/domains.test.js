import request from 'supertest';
import app from '../../src/app.js';
import { getAdminToken, authHeader, login, setupOperator, setupViewer } from '../helpers/api.js';

describe('Domains: customers, partners, categories', () => {
  let adminToken;
  let operator;
  let viewer;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    operator = await setupOperator();
    viewer = await setupViewer();
  });

  describe('Customers', () => {
    let customerPublicId;

    it('creates a customer', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set(authHeader(adminToken))
        .send({ name: 'Ramesh Patil', phone: '9876543210' });
      expect(res.status).toBe(201);
      expect(res.body.data.publicId).toBeTruthy();
      customerPublicId = res.body.data.publicId;
    });

    it('lists customers with search', async () => {
      const res = await request(app)
        .get('/api/v1/customers')
        .set(authHeader(adminToken))
        .query({ search: 'ramesh' });
      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBe(1);
      expect(res.body.data.rows[0].name).toBe('Ramesh Patil');
    });

    it('gets a customer by public id', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerPublicId}`)
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.publicId).toBe(customerPublicId);
    });

    it('updates a customer (admin only)', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${customerPublicId}`)
        .set(authHeader(adminToken))
        .send({ phone: '9123456789' });
      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('9123456789');
    });

    it('forbids operator from updating a customer', async () => {
      const opToken = (await login(operator.username, operator.password)).accessToken;
      const res = await request(app)
        .put(`/api/v1/customers/${customerPublicId}`)
        .set(authHeader(opToken))
        .send({ phone: '0000000000' });
      expect(res.status).toBe(403);
    });

    it('forbids viewer from creating a customer', async () => {
      const vToken = (await login(viewer.username, viewer.password)).accessToken;
      const res = await request(app)
        .post('/api/v1/customers')
        .set(authHeader(vToken))
        .send({ name: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('viewer can list customers (read-only)', async () => {
      const vToken = (await login(viewer.username, viewer.password)).accessToken;
      const res = await request(app).get('/api/v1/customers').set(authHeader(vToken));
      expect(res.status).toBe(200);
    });

    it('rejects invalid public id', async () => {
      const res = await request(app)
        .get('/api/v1/customers/not-a-uuid')
        .set(authHeader(adminToken));
      expect(res.status).toBe(400);
    });
  });

  describe('Partners', () => {
    let partnerPublicId;

    it('creates a partner', async () => {
      const res = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: 'Suresh Partner', notes: 'Capital partner' });
      expect(res.status).toBe(201);
      partnerPublicId = res.body.data.publicId;
    });

    it('lists partners with active filter', async () => {
      const res = await request(app)
        .get('/api/v1/partners')
        .set(authHeader(adminToken))
        .query({ activeOnly: 'true' });
      expect(res.status).toBe(200);
      expect(res.body.data.rows.some((p) => p.publicId === partnerPublicId)).toBe(true);
    });

    it('deactivates a partner', async () => {
      const res = await request(app)
        .put(`/api/v1/partners/${partnerPublicId}`)
        .set(authHeader(adminToken))
        .send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('refuses partner inflow for an inactive partner at creation', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set(authHeader(adminToken))
        .send({
          transactionType: 'intake',
          sourceType: 'partner_capital',
          partnerPublicId,
          amount: 5000,
          paymentMode: 'cash',
          transactionDate: '2026-06-01',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Categories', () => {
    it('lists active categories', async () => {
      const res = await request(app).get('/api/v1/categories/active').set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(7);
    });

    it('creates a category (admin only)', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set(authHeader(adminToken))
        .send({ name: 'Survey Work', slug: 'survey-work' });
      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('survey-work');
    });

    it('rejects duplicate slug', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set(authHeader(adminToken))
        .send({ name: 'Survey Work 2', slug: 'survey-work' });
      expect(res.status).toBe(409);
    });

    it('forbids operator from creating a category', async () => {
      const opToken = (await login(operator.username, operator.password)).accessToken;
      const res = await request(app)
        .post('/api/v1/categories')
        .set(authHeader(opToken))
        .send({ name: 'Hacked', slug: 'hacked' });
      expect(res.status).toBe(403);
    });
  });

  describe('Audit trail', () => {
    it('records customer creation in the audit log', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set(authHeader(adminToken))
        .query({ domain: 'customers', action: 'create' });
      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBeGreaterThan(0);
      expect(res.body.data.rows[0].domain).toBe('customers');
    });
  });
});