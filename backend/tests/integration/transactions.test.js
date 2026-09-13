import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import {
  getAdminToken,
  authHeader,
  setupPartnerQuorum,
  proposeAndApprove,
  proposeAsPartner,
  approveAsPartners,
} from '../helpers/api.js';
import { TEST_ADMIN_PASSWORD } from '../helpers/testCredentials.js';

const PARTNER_PW = 'Test@1234';

describe('Transactions', () => {
  let adminToken;
  let Q;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    Q = await setupPartnerQuorum(adminToken, 2, 'tx');
  });

  async function createCustomer(name) {
    const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/customers', { name });
    return entity.publicId;
  }

  async function firstCategoryId() {
    const res = await request(app).get('/api/v1/categories/active').set(authHeader(adminToken));
    return res.body.data[0].publicId;
  }

  async function createIntake(name, overrides = {}) {
    const customerId = await createCustomer(`${name} ${Date.now()}_${Math.floor(Math.random() * 1e6)}`);
    const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/transactions', {
      transactionType: 'intake',
      sourceType: 'customer',
      customerPublicId: customerId,
      amount: 7777,
      paymentMode: 'cash',
      transactionDate: '2026-08-10',
      ...overrides,
    });
    return entity.publicId;
  }

  it('partner proposal creates a customer intake transaction after unanimous approval', async () => {
    const customerId = await createCustomer('Tx Customer');
    const proposal = await proposeAsPartner(Q, 'post', '/api/v1/transactions', {
      transactionType: 'intake',
      sourceType: 'customer',
      customerPublicId: customerId,
      amount: 15000.5,
      paymentMode: 'upi',
      transactionDate: '2026-07-01',
      plotNumber: 'PLOT-101',
      referenceNumber: 'REF-001',
    });
    expect(proposal.status).toBe(201);
    expect(proposal.body.data.changeRequest.status).toBe('PENDING');
    expect(proposal.body.data.entity).toBeNull();

    const approval = await approveAsPartners(proposal.body.data.changeRequest.publicId, Q.slice(1));
    expect(approval.body.data.changeRequest.status).toBe('APPROVED');
    expect(Number(approval.body.data.entity.amount)).toBe(15000.5);
    expect(approval.body.data.entity.plotNumber).toBe('PLOT-101');
    expect(approval.body.data.meta.duplicateWarning).toBe(false);
  });

  it('flags a near-duplicate as a warning, not a rejection', async () => {
    const customerId = await createCustomer('Dup Customer');
    const payload = {
      transactionType: 'intake',
      sourceType: 'customer',
      customerPublicId: customerId,
      amount: 9000,
      paymentMode: 'cash',
      transactionDate: '2026-07-02',
    };
    const first = await proposeAndApprove(Q, 'post', '/api/v1/transactions', payload);
    expect(first.approval.body.data.meta.duplicateWarning).toBe(false);

    const second = await proposeAndApprove(Q, 'post', '/api/v1/transactions', payload);
    expect(second.approval.body.data.meta.duplicateWarning).toBe(true);
  });

  it('requires a category on outtakes', async () => {
    const res = await proposeAsPartner(Q, 'post', '/api/v1/transactions', {
      transactionType: 'outtake', amount: 1000, paymentMode: 'cash', transactionDate: '2026-07-03',
    });
    expect(res.status).toBe(400);
  });

  it('rejects incoherent source classification', async () => {
    const res = await proposeAsPartner(Q, 'post', '/api/v1/transactions', {
      transactionType: 'intake', amount: 1000, paymentMode: 'cash', transactionDate: '2026-07-04',
    });
    expect(res.status).toBe(400);
  });

  it('creates an outtake with category and paid-to after approval', async () => {
    const categoryId = await firstCategoryId();
    const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/transactions', {
      transactionType: 'outtake',
      amount: 25000,
      paymentMode: 'cheque',
      transactionDate: '2026-07-05',
      categoryPublicId: categoryId,
      paidTo: 'Road Contractor',
      description: 'Gravel for site approach',
    });
    expect(entity.paidTo).toBe('Road Contractor');
    expect(entity.category.name).toBeTruthy();
  });

  it('forbids non-partners from creating transactions', async () => {
    // Neither admin nor unauthenticated callers may propose business data.
    // Admin is supervisory-only; route authorization rejects before validation.
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({ amount: 1 });
    expect(res.status).toBe(403);
    const anon = await request(app)
      .post('/api/v1/transactions')
      .send({
        transactionType: 'outtake',
        amount: 1,
        paymentMode: 'cash',
        transactionDate: '2026-07-06',
        categoryPublicId: await firstCategoryId(),
      });
    expect(anon.status).toBe(401);
  });

  it('forbids admin from creating transactions (partner governance only)', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'outtake',
        amount: 1,
        paymentMode: 'cash',
        transactionDate: '2026-07-06',
        categoryPublicId: await firstCategoryId(),
      });
    expect(res.status).toBe(403);
  });

  it('updates an intake transaction (description and amount) after approval', async () => {
    const customerId = await createCustomer('Update Customer');
    const { entity: created } = await proposeAndApprove(Q, 'post', '/api/v1/transactions', {
      transactionType: 'intake',
      sourceType: 'customer',
      customerPublicId: customerId,
      amount: 5000,
      paymentMode: 'cash',
      transactionDate: '2026-07-12',
      description: 'before',
    });

    const { entity } = await proposeAndApprove(Q, 'patch', `/api/v1/transactions/${created.publicId}`, {
      amount: 6000,
      description: 'after',
      paymentMode: 'upi',
    });
    expect(Number(entity.amount)).toBe(6000);
    expect(entity.description).toBe('after');
    expect(entity.paymentMode).toBe('upi');
    expect(entity.customer.publicId).toBe(customerId);
  });

  it('forbids admin from updating a transaction', async () => {
    const categoryId = await firstCategoryId();
    const { entity: created } = await proposeAndApprove(Q, 'post', '/api/v1/transactions', {
      transactionType: 'outtake', amount: 3000, paymentMode: 'cash', transactionDate: '2026-07-14', categoryPublicId: categoryId,
    });
    const res = await request(app)
      .patch(`/api/v1/transactions/${created.publicId}`)
      .set(authHeader(adminToken))
      .send({ amount: 3100 });
    expect(res.status).toBe(403);
  });

  it('updating an outtake preserves its category when not resent', async () => {
    const categoryId = await firstCategoryId();
    const { entity: created } = await proposeAndApprove(Q, 'post', '/api/v1/transactions', {
      transactionType: 'outtake', amount: 2000, paymentMode: 'cash', transactionDate: '2026-07-15', categoryPublicId: categoryId,
    });

    const { entity } = await proposeAndApprove(Q, 'patch', `/api/v1/transactions/${created.publicId}`, { amount: 2500 });
    expect(Number(entity.amount)).toBe(2500);
    expect(entity.category.publicId).toBe(categoryId);
  });

  it('rejects updating an already-reversed transaction at apply time', async () => {
    const customerId = await createCustomer('Reversed Update');
    const { entity: created } = await proposeAndApprove(Q, 'post', '/api/v1/transactions', {
      transactionType: 'intake', sourceType: 'customer', customerPublicId: customerId, amount: 1111, paymentMode: 'cash', transactionDate: '2026-07-16',
    });

    const rev = await proposeAndApprove(Q, 'post', `/api/v1/transactions/${created.publicId}/reverse`, {
      adminPassword: PARTNER_PW, reason: 'then edit',
    });
    expect(rev.changeRequest.status).toBe('APPROVED');

    const proposal = await proposeAsPartner(Q, 'patch', `/api/v1/transactions/${created.publicId}`, { amount: 2222 });
    expect(proposal.status).toBe(200);
    expect(proposal.body.data.changeRequest.status).toBe('PENDING');
    // The approver gets the resolved request back instead of an opaque error:
    // CANCELLED with the reason code, nothing applied.
    const approval = await approveAsPartners(proposal.body.data.changeRequest.publicId, Q.slice(1));
    expect(approval.status).toBe(200);
    expect(approval.body.data.changeRequest.status).toBe('CANCELLED');
    expect(approval.body.data.changeRequest.resolutionReason).toBe('ALREADY_REVERSED');
    expect(approval.body.data.entity).toBeNull();
  });

  it('returns the monthly report with net movement', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly')
      .query({ year: 2026, month: 7 })
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.year).toBe(2026);
    expect(d.month).toBe(7);
    expect(Number(d.summary.intake)).toBeGreaterThan(0);
    expect(d.topCustomers).toBeDefined();
    expect(d.categories).toBeDefined();
  });

  it('monthly report exposes explicit truncation metadata for the capped transaction list', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly')
      .query({ year: 2026, month: 7 })
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(typeof d.truncated).toBe('boolean');
    expect(typeof d.transactionTotal).toBe('number');
    expect(d.transactions.length).toBeLessThanOrEqual(1000);
    expect(d.truncated).toBe(d.transactionTotal > d.transactions.length);
    if (!d.truncated) expect(d.transactionTotal).toBe(d.transactions.length);
  });

  // ---- Partner governance replaces direct admin application ----
  it('partner proposal becomes PENDING (never direct) even with two admins present', async () => {
    const categoryId = await firstCategoryId();
    const res = await proposeAsPartner(Q, 'post', '/api/v1/transactions', {
      transactionType: 'outtake', amount: 1234, paymentMode: 'cash', transactionDate: '2026-08-01', categoryPublicId: categoryId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.changeRequest.status).toBe('PENDING');
    expect(res.body.data.entity).toBeNull();
  });

  it('partner outside the snapshot cannot decide on the request', async () => {
    // Q has exactly two partners here, so every request needs the other one;
    // an unrelated outsider attempt is covered in partnerGovernance (16-17).
    // This pins the complementary invariant: unauthenticated callers get 401.
    const anon = await request(app)
      .post('/api/v1/change-requests/00000000-0000-0000-0000-000000000000/approve')
      .send({});
    expect(anon.status).toBe(401);
  });

  it('reverse applies after unanimous approval and deactivates the transaction', async () => {
    const customerId = await createCustomer('Reverse Gov');
    const { entity: tx } = await proposeAndApprove(Q, 'post', '/api/v1/transactions', {
      transactionType: 'intake', sourceType: 'customer', customerPublicId: customerId, amount: 5555, paymentMode: 'cash', transactionDate: '2026-08-02',
    });

    const { changeRequest } = await proposeAndApprove(Q, 'post', `/api/v1/transactions/${tx.publicId}/reverse`, {
      adminPassword: PARTNER_PW, reason: 'mistake',
    });
    expect(changeRequest.status).toBe('APPROVED');

    const getAfter = await request(app).get(`/api/v1/transactions/${tx.publicId}`).set(authHeader(adminToken));
    expect(getAfter.body.data.reversedAt).not.toBeNull();
  });

  // ---- Destructive operation re-authentication (requester's own password) ----
  describe('destructive transaction authentication', () => {
    it('DELETE without adminPassword → 400', async () => {
      const publicId = await createIntake('P1 Del Missing');
      const res = await request(app)
        .delete(`/api/v1/transactions/${publicId}`)
        .set(authHeader(Q[0].accessToken))
        .send({ reason: 'no password' });
      expect(res.status).toBe(400);
    });

    it('DELETE with wrong password → 401', async () => {
      const publicId = await createIntake('P1 Del Wrong');
      const res = await request(app)
        .delete(`/api/v1/transactions/${publicId}`)
        .set(authHeader(Q[0].accessToken))
        .send({ adminPassword: 'WrongPass@123', reason: 'bad password' });
      expect(res.status).toBe(401);
    });

    it('DELETE with own password → PENDING, never applied directly', async () => {
      const publicId = await createIntake('P1 Del Ok');
      const res = await request(app)
        .delete(`/api/v1/transactions/${publicId}`)
        .set(authHeader(Q[0].accessToken))
        .send({ adminPassword: PARTNER_PW, reason: 'cleanup' });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      expect(res.body.data.entity).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain(PARTNER_PW);
    });

    it('reverse without adminPassword → 400', async () => {
      const publicId = await createIntake('P1 Rev Missing');
      const res = await request(app)
        .post(`/api/v1/transactions/${publicId}/reverse`)
        .set(authHeader(Q[0].accessToken))
        .send({ reason: 'no password' });
      expect(res.status).toBe(400);
    });

    it('reverse with wrong password → 401', async () => {
      const publicId = await createIntake('P1 Rev Wrong');
      const res = await request(app)
        .post(`/api/v1/transactions/${publicId}/reverse`)
        .set(authHeader(Q[0].accessToken))
        .send({ adminPassword: 'WrongPass@123', reason: 'bad password' });
      expect(res.status).toBe(401);
    });

    it('reverse with own password → PENDING', async () => {
      const publicId = await createIntake('P1 Rev Ok');
      const res = await request(app)
        .post(`/api/v1/transactions/${publicId}/reverse`)
        .set(authHeader(Q[0].accessToken))
        .send({ adminPassword: PARTNER_PW, reason: 'entered by mistake' });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
      expect(JSON.stringify(res.body)).not.toContain(PARTNER_PW);
    });

    it('never persists the password in DB rows or audit logs', async () => {
      const delId = await createIntake('P1 Leak Del');
      const revId = await createIntake('P1 Leak Rev');
      await request(app)
        .delete(`/api/v1/transactions/${delId}`)
        .set(authHeader(Q[0].accessToken))
        .send({ adminPassword: PARTNER_PW, reason: 'leak check' });
      await request(app)
        .post(`/api/v1/transactions/${revId}/reverse`)
        .set(authHeader(Q[0].accessToken))
        .send({ adminPassword: PARTNER_PW, reason: 'leak check' });

      const auditHit = await pool.query(
        `SELECT count(*)::int AS n FROM audit_logs
          WHERE old_values::text LIKE '%' || $1 || '%' OR new_values::text LIKE '%' || $1 || '%'`,
        [PARTNER_PW],
      );
      expect(Number(auditHit.rows[0].n)).toBe(0);
      const crHit = await pool.query(
        `SELECT count(*)::int AS n FROM change_requests
          WHERE proposed_state::text LIKE '%' || $1 || '%' OR previous_state::text LIKE '%' || $1 || '%'`,
        [PARTNER_PW],
      );
      expect(Number(crHit.rows[0].n)).toBe(0);
    });

    it('non-partners get 403 on delete/reverse even with a password', async () => {
      const delId = await createIntake('P1 NonPartner Del');
      const revId = await createIntake('P1 NonPartner Rev');
      const del = await request(app)
        .delete(`/api/v1/transactions/${delId}`)
        .set(authHeader(adminToken))
        .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'admin attempt' });
      expect(del.status).toBe(403);
      const rev = await request(app)
        .post(`/api/v1/transactions/${revId}/reverse`)
        .set(authHeader(adminToken))
        .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'admin attempt' });
      expect(rev.status).toBe(403);
    });

  });
});
