import request from 'supertest';
import app from '../../src/app.js';
import { getAdminToken, authHeader } from '../helpers/api.js';

describe('Financial correctness', () => {
  let adminToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    // Opening balance = 100,000
    const res = await request(app)
      .put('/api/v1/settings/opening_balance')
      .set(authHeader(adminToken))
      .send({ value: 100000 });
    expect(res.status).toBe(200);
  });

  async function createCustomer(name) {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(authHeader(adminToken))
      .send({ name });
    expect(res.status).toBe(201);
    return res.body.data.entity.publicId;
  }

  async function createPartner(name) {
    const res = await request(app)
      .post('/api/v1/partners')
      .set(authHeader(adminToken))
      .send({ name });
    expect(res.status).toBe(201);
    return res.body.data.entity.publicId;
  }

  async function categorySlugToId(slug) {
    const res = await request(app).get('/api/v1/categories').set(authHeader(adminToken));
    return res.body.data.rows.find((c) => c.slug === slug).publicId;
  }

  async function intake({ sourceType, customerId, partnerId, amount, date }) {
    const body = { transactionType: 'intake', sourceType, amount, paymentMode: 'cash', transactionDate: date };
    if (customerId) body.customerPublicId = customerId;
    if (partnerId) body.partnerPublicId = partnerId;
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send(body);
    expect(res.status).toBe(201);
    return res.body.data.entity;
  }

  async function outtake({ categoryId, amount, date }) {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(authHeader(adminToken))
      .send({
        transactionType: 'outtake',
        amount,
        paymentMode: 'bank_transfer',
        transactionDate: date,
        categoryPublicId: categoryId,
        paidTo: 'Contractor',
      });
    expect(res.status).toBe(201);
    return res.body.data.entity;
  }

  it('computes the exact expected balance from the spec scenario', async () => {
    const DATE = '2026-04-10';
    const customerA = await createCustomer('Finance Customer A');
    const customerB = await createCustomer('Finance Customer B');
    const partner = await createPartner('Finance Partner');
    const roadCat = await categorySlugToId('road-construction');
    const laborCat = await categorySlugToId('labor');

    // Customer receipts: 50,000 + 25,000
    await intake({ sourceType: 'customer', customerId: customerA, amount: 50000, date: DATE });
    await intake({ sourceType: 'customer', customerId: customerB, amount: 25000, date: DATE });
    // Partner capital: 100,000
    await intake({ sourceType: 'partner_capital', partnerId: partner, amount: 100000, date: DATE });
    // Partner loan: 50,000
    await intake({ sourceType: 'partner_loan', partnerId: partner, amount: 50000, date: DATE });
    // Expenses: 40,000 + 20,000
    await outtake({ categoryId: roadCat, amount: 40000, date: DATE });
    await outtake({ categoryId: laborCat, amount: 20000, date: DATE });

    // Expected: 100000 + 50000 + 25000 + 100000 + 50000 - 40000 - 20000 = 265000
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);

    const d = res.body.data;
    expect(Number(d.openingBalance)).toBe(100000);
    expect(Number(d.balance)).toBe(265000);
    expect(Number(d.totals.totalIntake)).toBe(225000);
    expect(Number(d.totals.totalOuttake)).toBe(60000);
    expect(Number(d.totals.customerIntake)).toBe(75000);
    expect(Number(d.totals.partnerCapital)).toBe(100000);
    expect(Number(d.totals.partnerLoan)).toBe(50000);
  });

  it('reflects each financial source exactly once in reports', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily')
      .query({ date: '2026-04-10' })
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(Number(d.summary.intake)).toBe(225000);
    expect(Number(d.summary.outtake)).toBe(60000);
    expect(Number(d.summary.customerIntake)).toBe(75000);
    expect(Number(d.summary.partnerCapital)).toBe(100000);
    expect(Number(d.summary.partnerLoan)).toBe(50000);
    expect(Number(d.balance.balanceAtEndOfDay)).toBe(265000);
  });

  it('does not double-count after a reversal', async () => {
    const DATE = '2026-05-05';
    const customer = await createCustomer('Reversal Customer');
    const tx = await intake({ sourceType: 'customer', customerId: customer, amount: 30000, date: DATE });

    const reverseRes = await request(app)
      .post(`/api/v1/transactions/${tx.publicId}/reverse`)
      .set(authHeader(adminToken))
      .send({ adminPassword: 'Admin@123', reason: 'entered by mistake' });
    expect(reverseRes.status).toBe(200);

    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set(authHeader(adminToken));
    const d = res.body.data;
    // 265000 + 30000 (new intake) - 30000 (reversed) = 265000
    expect(Number(d.balance)).toBe(265000);
    expect(Number(d.totals.customerIntake)).toBe(75000);
  });

  it('excludes soft-deleted transactions from the balance', async () => {
    const DATE = '2026-05-06';
    const customer = await createCustomer('Delete Customer');
    const tx = await intake({ sourceType: 'customer', customerId: customer, amount: 40000, date: DATE });

    const delRes = await request(app)
      .delete(`/api/v1/transactions/${tx.publicId}`)
      .set(authHeader(adminToken))
      .send({ adminPassword: 'Admin@123', reason: 'cleanup' });
    expect(delRes.status).toBe(200);

    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set(authHeader(adminToken));
    const d = res.body.data;
    // 265000 + 40000 (new) - 40000 (deleted) = 265000
    expect(Number(d.balance)).toBe(265000);
    expect(Number(d.totals.customerIntake)).toBe(75000);
  });

  it('partner report totals span all ledger pages, not just the current page', async () => {
    const partner = await createPartner('Paged Partner');
    const DATE = '2026-05-07';
    const expectedCapital = [10000, 20000, 30000, 40000, 50000].reduce((a, b) => a + b, 0);
    for (const amount of [10000, 20000, 30000, 40000, 50000]) {
      await intake({ sourceType: 'partner_capital', partnerId: partner, amount, date: DATE });
    }

    const res = await request(app)
      .get(`/api/v1/reports/partners/${partner}`)
      .query({ page: 1, limit: 2 })
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);

    const d = res.body.data;
    expect(Number(d.totals.capitalContributions)).toBe(expectedCapital);
    expect(Number(d.totals.totalInflow)).toBe(expectedCapital);
    expect(Number(d.totals.loanReceipts)).toBe(0);
    expect(d.ledger.rows.length).toBe(2);
  });
});
