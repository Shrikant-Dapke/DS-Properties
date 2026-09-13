import request from 'supertest';
import app from '../../src/app.js';
import {
  getAdminToken,
  authHeader,
  setupPartnerQuorum,
  proposeAndApprove,
  proposeAsPartner,
  approveAsPartners,
} from '../helpers/api.js';

describe('Domains: customers, partners, categories (via partner governance)', () => {
  let adminToken;
  let Q;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    Q = await setupPartnerQuorum(adminToken, 2, 'dom');
  });

  describe('Customers', () => {
    let customerPublicId;

    it('partner proposal creates a customer after unanimous approval', async () => {
      const proposal = await proposeAsPartner(Q, 'post', '/api/v1/customers', {
        name: 'Ramesh Patil',
        phone: '9876543210',
      });
      expect(proposal.status).toBe(201);
      expect(proposal.body.data.changeRequest.status).toBe('PENDING');
      const approval = await approveAsPartners(proposal.body.data.changeRequest.publicId, Q.slice(1));
      expect(approval.body.data.changeRequest.status).toBe('APPROVED');
      expect(approval.body.data.entity.publicId).toBeTruthy();
      customerPublicId = approval.body.data.entity.publicId;
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

    it('updates a customer after unanimous approval', async () => {
      const { entity } = await proposeAndApprove(Q, 'put', `/api/v1/customers/${customerPublicId}`, {
        phone: '9123456789',
      });
      expect(entity.phone).toBe('9123456789');
    });

    it('forbids admin from updating a customer', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${customerPublicId}`)
        .set(authHeader(adminToken))
        .send({ phone: '0000000000' });
      expect(res.status).toBe(403);
    });

    it('forbids partners from managing users (separation of duties)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set(authHeader(Q[0].accessToken))
        .send({ username: 'Nope', password: 'Test@1234', fullName: 'N', role: 'partner' });
      expect(res.status).toBe(403);
    });

    it('partners can list customers (read-only)', async () => {
      const res = await request(app).get('/api/v1/customers').set(authHeader(Q[1].accessToken));
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

    it('admin creates a partner record directly (membership management)', async () => {
      const res = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(adminToken))
        .send({ name: 'Suresh Partner', notes: 'Capital partner' });
      expect(res.status).toBe(201);
      expect(res.body.data.changeRequest).toBeNull();
      partnerPublicId = res.body.data.entity.publicId;
    });

    it('partner cannot create partner records (membership is admin-managed)', async () => {
      const res = await request(app)
        .post('/api/v1/partners')
        .set(authHeader(Q[0].accessToken))
        .send({ name: 'SelfAdded' });
      expect(res.status).toBe(403);
    });

    it('lists partners with active filter', async () => {
      const res = await request(app)
        .get('/api/v1/partners')
        .set(authHeader(adminToken))
        .query({ activeOnly: 'true' });
      expect(res.status).toBe(200);
      expect(res.body.data.rows.some((p) => p.publicId === partnerPublicId)).toBe(true);
    });

    it('admin deactivates a partner record directly', async () => {
      const res = await request(app)
        .put(`/api/v1/partners/${partnerPublicId}`)
        .set(authHeader(adminToken))
        .send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.data.entity.isActive).toBe(false);
    });

    it('refuses partner inflow for an inactive partner (fails fast, nothing proposed)', async () => {
      const proposal = await proposeAsPartner(Q, 'post', '/api/v1/transactions', {
        transactionType: 'intake',
        sourceType: 'partner_capital',
        partnerPublicId,
        amount: 5000,
        paymentMode: 'cash',
        transactionDate: '2026-06-01',
      });
      expect(proposal.status).toBe(400);
      // No change request was created for the invalid inflow.
      const open = await request(app).get('/api/v1/change-requests').query({ status: 'PENDING', limit: 100 }).set(authHeader(adminToken));
      expect(open.body.data.rows.some(
        (r) => r.entityType === 'transaction' && r.operation === 'create' && r.proposedState?.partnerPublicId === partnerPublicId,
      )).toBe(false);
    });
  });

  describe('Categories', () => {
    it('lists active categories', async () => {
      const res = await request(app).get('/api/v1/categories/active').set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(7);
    });

    it('partner proposal creates a category after unanimous approval', async () => {
      const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/categories', {
        name: 'Survey Work',
        slug: 'survey-work',
      });
      expect(entity.slug).toBe('survey-work');
    });

    it('duplicate slug resolves CANCELLED instead of recording', async () => {
      const proposal = await proposeAsPartner(Q, 'post', '/api/v1/categories', {
        name: 'Survey Work 2',
        slug: 'survey-work',
      });
      expect(proposal.status).toBe(201);
      const approval = await approveAsPartners(proposal.body.data.changeRequest.publicId, Q.slice(1));
      expect(approval.status).toBe(200);
      expect(approval.body.data.changeRequest.status).toBe('CANCELLED');
      expect(approval.body.data.changeRequest.resolutionReason).toBe('SLUG_TAKEN');
      expect(approval.body.data.entity).toBeNull();
    });

    it('forbids admin from creating a category', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set(authHeader(adminToken))
        .send({ name: 'AdminCat', slug: 'admin-cat' });
      expect(res.status).toBe(403);
    });

    it('partner category creation always becomes PENDING, never direct', async () => {
      const res = await proposeAsPartner(Q, 'post', '/api/v1/categories', { name: 'Direct?', slug: 'direct-check' });
      expect(res.status).toBe(201);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      expect(res.body.data.entity).toBeNull();
    });
  });

  describe('Audit trail', () => {
    it('records governed customer creation in the audit log', async () => {
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
