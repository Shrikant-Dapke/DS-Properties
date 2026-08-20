import request from 'supertest';
import app from '../../src/app.js';
import { getAdminToken, authHeader, login, setupOperator, setupViewer } from '../helpers/api.js';

describe('Transactions', () => {
  let adminToken;
  let operator;
  let viewer;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    operator = await setupOperator();
    viewer = await setupViewer();
  });

  async function createCustomer(name) {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(authHeader(adminToken))
      .send({ name });
    return res.body.data.publicId;
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
    expect(Number(res.body.data.transaction.amount)).toBe(15000.5);
    expect(res.body.data.transaction.plotNumber).toBe('PLOT-101');
    expect(res.body.data.duplicateWarning).toBe(false);
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
    expect(first.body.data.duplicateWarning).toBe(false);

    const second = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send(payload);
    expect(second.status).toBe(201);
    expect(second.body.data.duplicateWarning).toBe(true);
    expect(second.body.data.duplicates.length).toBeGreaterThan(0);
  });

  it('requires a category on outtakes', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'outtake',
        amount: 1000,
        paymentMode: 'cash',
        transactionDate: '2026-07-03',
      });
    expect(res.status).toBe(400);
  });

  it('rejects incoherent source classification', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'intake',
        amount: 1000,
        paymentMode: 'cash',
        transactionDate: '2026-07-04',
      });
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
    expect(res.body.data.transaction.paidTo).toBe('Road Contractor');
    expect(res.body.data.transaction.category.name).toBeTruthy();
  });

  it('forbids viewer from creating transactions', async () => {
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

  it('operator can create transactions', async () => {
    const opToken = (await login(operator.username, operator.password)).accessToken;
    const categoryId = await firstCategoryId();
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(opToken))
      .send({
        transactionType: 'outtake',
        amount: 5000,
        paymentMode: 'cash',
        transactionDate: '2026-07-07',
        categoryPublicId: categoryId,
        paidTo: 'Daily wages',
      });
    expect(res.status).toBe(201);
  });

  it('operator cannot reverse a transaction (admin only)', async () => {
    const opToken = (await login(operator.username, operator.password)).accessToken;
    const customerId = await createCustomer('Forbidden Reverse');
    const tx = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'intake',
        sourceType: 'customer',
        customerPublicId: customerId,
        amount: 7777,
        paymentMode: 'cash',
        transactionDate: '2026-07-08',
      });
    const publicId = tx.body.data.transaction.publicId;

    const res = await request(app)
      .post(`/api/v1/transactions/${publicId}/reverse`)
      .set(authHeader(opToken))
      .send({ adminPassword: 'Test@1234', reason: 'hack' });
    expect(res.status).toBe(403);
  });

  it('reversal requires a valid admin password', async () => {
    const customerId = await createCustomer('Wrong Admin Pass');
    const tx = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'intake',
        sourceType: 'customer',
        customerPublicId: customerId,
        amount: 5000,
        paymentMode: 'cash',
        transactionDate: '2026-07-09',
      });
    const publicId = tx.body.data.transaction.publicId;

    const res = await request(app)
      .post(`/api/v1/transactions/${publicId}/reverse`)
      .set(authHeader(adminToken))
      .send({ adminPassword: 'WrongAdmin@1', reason: 'test' });
    expect(res.status).toBe(401);
  });

  it('cannot reverse an already reversed transaction', async () => {
    const customerId = await createCustomer('Double Reverse');
    const tx = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'intake',
        sourceType: 'customer',
        customerPublicId: customerId,
        amount: 2222,
        paymentMode: 'cash',
        transactionDate: '2026-07-10',
      });
    const publicId = tx.body.data.transaction.publicId;

    const first = await request(app)
      .post(`/api/v1/transactions/${publicId}/reverse`)
      .set(authHeader(adminToken))
      .send({ adminPassword: 'Admin@123', reason: 'first' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/v1/transactions/${publicId}/reverse`)
      .set(authHeader(adminToken))
      .send({ adminPassword: 'Admin@123', reason: 'second' });
    expect(second.status).toBe(409);
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
});