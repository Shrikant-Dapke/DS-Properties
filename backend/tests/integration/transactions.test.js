import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import { getAdminToken, authHeader, login, setupViewer, setupSecondAdmin } from '../helpers/api.js';
import { TEST_ADMIN_PASSWORD } from '../helpers/testCredentials.js';

describe('Transactions', () => {
  let adminToken;
  let viewer;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    viewer = await setupViewer();
  });

  async function createCustomer(name) {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(authHeader(adminToken))
      .send({ name });
    return res.body.data.entity?.publicId ?? res.body.data.publicId;
  }

  async function firstCategoryId() {
    const res = await request(app).get('/api/v1/categories/active').set(authHeader(adminToken));
    return res.body.data[0].publicId;
  }

  it('creates a customer intake transaction', async () => {
    const customerId = await createCustomer('Tx Customer');
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'intake',
        sourceType: 'customer',
        customerPublicId: customerId,
        amount: 15000.5,
        paymentMode: 'upi',
        transactionDate: '2026-07-01',
        plotNumber: 'PLOT-101',
        referenceNumber: 'REF-001',
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.entity.amount)).toBe(15000.5);
    expect(res.body.data.entity.plotNumber).toBe('PLOT-101');
    expect(res.body.data.meta.duplicateWarning).toBe(false);
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
    const first = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send(payload);
    expect(first.status).toBe(201);
    expect(first.body.data.meta.duplicateWarning).toBe(false);

    const second = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send(payload);
    expect(second.status).toBe(201);
    expect(second.body.data.meta.duplicateWarning).toBe(true);
  });

  it('requires a category on outtakes', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({ transactionType: 'outtake', amount: 1000, paymentMode: 'cash', transactionDate: '2026-07-03' });
    expect(res.status).toBe(400);
  });

  it('rejects incoherent source classification', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({ transactionType: 'intake', amount: 1000, paymentMode: 'cash', transactionDate: '2026-07-04' });
    expect(res.status).toBe(400);
  });

  it('creates an outtake with category and paid-to', async () => {
    const categoryId = await firstCategoryId();
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'outtake',
        amount: 25000,
        paymentMode: 'cheque',
        transactionDate: '2026-07-05',
        categoryPublicId: categoryId,
        paidTo: 'Road Contractor',
        description: 'Gravel for site approach',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.entity.paidTo).toBe('Road Contractor');
    expect(res.body.data.entity.category.name).toBeTruthy();
  });

  it('forbids read_only from creating transactions', async () => {
    const vToken = (await login(viewer.username, viewer.password)).accessToken;
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(vToken))
      .send({
        transactionType: 'outtake',
        amount: 1,
        paymentMode: 'cash',
        transactionDate: '2026-07-06',
        categoryPublicId: await firstCategoryId(),
      });
    expect(res.status).toBe(403);
  });

  it('updates an intake transaction (description and amount)', async () => {
    const customerId = await createCustomer('Update Customer');
    const created = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'intake',
        sourceType: 'customer',
        customerPublicId: customerId,
        amount: 5000,
        paymentMode: 'cash',
        transactionDate: '2026-07-12',
        description: 'before',
      });
    const publicId = created.body.data.entity.publicId;

    const res = await request(app)
      .patch(`/api/v1/transactions/${publicId}`)
      .set(authHeader(adminToken))
      .send({ amount: 6000, description: 'after', paymentMode: 'upi' });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.entity.amount)).toBe(6000);
    expect(res.body.data.entity.description).toBe('after');
    expect(res.body.data.entity.paymentMode).toBe('upi');
    expect(res.body.data.entity.customer.publicId).toBe(customerId);
  });

  it('forbids read_only from updating a transaction', async () => {
    const vToken = (await login(viewer.username, viewer.password)).accessToken;
    const categoryId = await firstCategoryId();
    const created = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({ transactionType: 'outtake', amount: 3000, paymentMode: 'cash', transactionDate: '2026-07-14', categoryPublicId: categoryId });
    const res = await request(app)
      .patch(`/api/v1/transactions/${created.body.data.entity.publicId}`)
      .set(authHeader(vToken))
      .send({ amount: 3100 });
    expect(res.status).toBe(403);
  });

  it('updating an outtake preserves its category when not resent', async () => {
    const categoryId = await firstCategoryId();
    const created = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({ transactionType: 'outtake', amount: 2000, paymentMode: 'cash', transactionDate: '2026-07-15', categoryPublicId: categoryId });
    const publicId = created.body.data.entity.publicId;

    const res = await request(app)
      .patch(`/api/v1/transactions/${publicId}`)
      .set(authHeader(adminToken))
      .send({ amount: 2500 });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.entity.amount)).toBe(2500);
    expect(res.body.data.entity.category.publicId).toBe(categoryId);
  });

  it('rejects updating an already-reversed transaction', async () => {
    const customerId = await createCustomer('Reversed Update');
    const created = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({ transactionType: 'intake', sourceType: 'customer', customerPublicId: customerId, amount: 1111, paymentMode: 'cash', transactionDate: '2026-07-16' });
    const publicId = created.body.data.entity.publicId;

    const reversed = await request(app)
      .post(`/api/v1/transactions/${publicId}/reverse`)
      .set(authHeader(adminToken))
      .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'then edit' });
    expect(reversed.status).toBe(200);

    const res = await request(app)
      .patch(`/api/v1/transactions/${publicId}`)
      .set(authHeader(adminToken))
      .send({ amount: 2222 });
    expect(res.status).toBe(409);
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

  // ---- Governance (multi-admin approval applies to sensitive user ops) ----
  it('applies a transaction directly without a pending change request (even with two admins)', async () => {
    await setupSecondAdmin();
    const categoryId = await firstCategoryId();
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({ transactionType: 'outtake', amount: 1234, paymentMode: 'cash', transactionDate: '2026-08-01', categoryPublicId: categoryId });
    expect(res.status).toBe(201);
    expect(res.body.data.changeRequest).toBeNull();
    expect(res.body.data.entity).not.toBeNull();
    expect(Number(res.body.data.entity.amount)).toBe(1234);
  });

  it('read_only cannot access approval APIs', async () => {
    const vToken = (await login(viewer.username, viewer.password)).accessToken;
    const list = await request(app).get('/api/v1/change-requests').set(authHeader(vToken));
    expect(list.status).toBe(403);
    const approve = await request(app)
      .post('/api/v1/change-requests/00000000-0000-0000-0000-000000000000/approve')
      .set(authHeader(vToken))
      .send({});
    expect(approve.status).toBe(403);
  });

  it('reverse applies directly and deactivates the transaction', async () => {
    const customerId = await createCustomer('Reverse Gov');
    const tx = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({ transactionType: 'intake', sourceType: 'customer', customerPublicId: customerId, amount: 5555, paymentMode: 'cash', transactionDate: '2026-08-02' });
    const publicId = tx.body.data.entity.publicId;

    const rev = await request(app)
      .post(`/api/v1/transactions/${publicId}/reverse`)
      .set(authHeader(adminToken))
      .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'mistake' });
    expect(rev.status).toBe(200);
    expect(rev.body.data.changeRequest).toBeNull();

    const getAfter = await request(app).get(`/api/v1/transactions/${publicId}`).set(authHeader(adminToken));
    expect(getAfter.body.data.reversedAt).not.toBeNull();
  });

  // ---- P1: destructive transaction authentication (canonical admin-password re-entry) ----
  describe('destructive transaction authentication', () => {
    async function createIntake(name = 'P1 Customer') {
      const customerId = await createCustomer(`${name} ${Date.now()}_${Math.floor(Math.random() * 1e6)}`);
      const res = await request(app)
        .post('/api/v1/transactions')
        .set(authHeader(adminToken))
        .send({
          transactionType: 'intake',
          sourceType: 'customer',
          customerPublicId: customerId,
          amount: 7777,
          paymentMode: 'cash',
          transactionDate: '2026-08-10',
        });
      expect(res.status).toBe(201);
      return res.body.data.entity.publicId;
    }

    it('DELETE without adminPassword → 400', async () => {
      const publicId = await createIntake('P1 Del Missing');
      const res = await request(app)
        .delete(`/api/v1/transactions/${publicId}`)
        .set(authHeader(adminToken))
        .send({ reason: 'no password' });
      expect(res.status).toBe(400);
    });

    it('DELETE with wrong adminPassword → 401', async () => {
      const publicId = await createIntake('P1 Del Wrong');
      const res = await request(app)
        .delete(`/api/v1/transactions/${publicId}`)
        .set(authHeader(adminToken))
        .send({ adminPassword: 'WrongPass@123', reason: 'bad password' });
      expect(res.status).toBe(401);
    });

    it('DELETE with correct adminPassword → 200', async () => {
      const publicId = await createIntake('P1 Del Ok');
      const res = await request(app)
        .delete(`/api/v1/transactions/${publicId}`)
        .set(authHeader(adminToken))
        .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'cleanup' });
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(TEST_ADMIN_PASSWORD);
    });

    it('reverse without adminPassword → 400', async () => {
      const publicId = await createIntake('P1 Rev Missing');
      const res = await request(app)
        .post(`/api/v1/transactions/${publicId}/reverse`)
        .set(authHeader(adminToken))
        .send({ reason: 'no password' });
      expect(res.status).toBe(400);
    });

    it('reverse with wrong adminPassword → 401', async () => {
      const publicId = await createIntake('P1 Rev Wrong');
      const res = await request(app)
        .post(`/api/v1/transactions/${publicId}/reverse`)
        .set(authHeader(adminToken))
        .send({ adminPassword: 'WrongPass@123', reason: 'bad password' });
      expect(res.status).toBe(401);
    });

    it('reverse with correct adminPassword → 200', async () => {
      const publicId = await createIntake('P1 Rev Ok');
      const res = await request(app)
        .post(`/api/v1/transactions/${publicId}/reverse`)
        .set(authHeader(adminToken))
        .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'entered by mistake' });
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(TEST_ADMIN_PASSWORD);
    });

    it('never persists the admin password in DB rows or audit logs', async () => {
      const delId = await createIntake('P1 Leak Del');
      const revId = await createIntake('P1 Leak Rev');
      await request(app)
        .delete(`/api/v1/transactions/${delId}`)
        .set(authHeader(adminToken))
        .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'leak check' });
      await request(app)
        .post(`/api/v1/transactions/${revId}/reverse`)
        .set(authHeader(adminToken))
        .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'leak check' });

      const auditHit = await pool.query(
        `SELECT count(*)::int AS n FROM audit_logs
          WHERE old_values::text LIKE '%' || $1 || '%' OR new_values::text LIKE '%' || $1 || '%'`,
        [TEST_ADMIN_PASSWORD],
      );
      expect(Number(auditHit.rows[0].n)).toBe(0);
      const crHit = await pool.query(
        `SELECT count(*)::int AS n FROM change_requests
          WHERE proposed_state::text LIKE '%' || $1 || '%' OR previous_state::text LIKE '%' || $1 || '%'`,
        [TEST_ADMIN_PASSWORD],
      );
      expect(Number(crHit.rows[0].n)).toBe(0);
    });

    it('read_only gets 403 on delete/reverse even with a password', async () => {
      const vToken = (await login(viewer.username, viewer.password)).accessToken;
      const delId = await createIntake('P1 Viewer Del');
      const revId = await createIntake('P1 Viewer Rev');
      const del = await request(app)
        .delete(`/api/v1/transactions/${delId}`)
        .set(authHeader(vToken))
        .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'viewer attempt' });
      expect(del.status).toBe(403);
      const rev = await request(app)
        .post(`/api/v1/transactions/${revId}/reverse`)
        .set(authHeader(vToken))
        .send({ adminPassword: TEST_ADMIN_PASSWORD, reason: 'viewer attempt' });
      expect(rev.status).toBe(403);
    });
  });
});
