import request from 'supertest';
import app from '../../src/app.js';
import { getAdminToken, authHeader } from '../helpers/api.js';
import { cacheGet } from '../../src/utils/cache.js';

describe('Date-range filtering', () => {
  let adminToken;
  const createdTransactions = [];

  beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  // Tests in this suite share one schema reset (beforeAll), so each test
  // soft-deletes the transactions it created — keeping financial aggregates
  // isolated between tests (and invalidating the financial cache).
  afterEach(async () => {
    for (const publicId of createdTransactions.splice(0)) {
      await request(app)
        .delete(`/api/v1/transactions/${publicId}`)
        .set(authHeader(adminToken))
        .send({ adminPassword: 'Admin@123', reason: 'dateRange test cleanup' });
    }
  });

  async function createCustomer(name) {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(authHeader(adminToken))
      .send({ name });
    expect(res.status).toBe(201);
    return res.body.data.publicId;
  }

  async function createPartner(name) {
    const res = await request(app)
      .post('/api/v1/partners')
      .set(authHeader(adminToken))
      .send({ name });
    expect(res.status).toBe(201);
    return res.body.data.publicId;
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
    createdTransactions.push(res.body.data.transaction.publicId);
    return res.body.data.transaction;
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
    createdTransactions.push(res.body.data.transaction.publicId);
    return res.body.data.transaction;
  }

  describe('transactions list', () => {
    it('includes both boundary dates and excludes transactions outside the range', async () => {
      const customer = await createCustomer('Range Customer');
      await intake({ sourceType: 'customer', customerId: customer, amount: 1000, date: '2026-03-31' });
      await intake({ sourceType: 'customer', customerId: customer, amount: 2000, date: '2026-04-01' });
      await intake({ sourceType: 'customer', customerId: customer, amount: 3000, date: '2026-06-15' });
      await intake({ sourceType: 'customer', customerId: customer, amount: 4000, date: '2027-03-31' });

      const res = await request(app)
        .get('/api/v1/transactions')
        .query({ from: '2026-03-31', to: '2026-04-01', limit: 100 })
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      const amounts = res.body.data.rows.map((t) => Number(t.amount)).sort();
      expect(amounts).toEqual([1000, 2000]);
      expect(res.body.data.pagination.total).toBe(2);

      const res2 = await request(app)
        .get('/api/v1/transactions')
        .query({ from: '2026-04-02', to: '2027-03-30', limit: 100 })
        .set(authHeader(adminToken));
      expect(res2.body.data.rows.map((t) => Number(t.amount))).toEqual([3000]);
    });

    it('rejects from > to with a clear validation error', async () => {
      const res = await request(app)
        .get('/api/v1/transactions')
        .query({ from: '2026-04-02', to: '2026-04-01' })
        .set(authHeader(adminToken));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].message).toContain('after');
    });

    it('rejects malformed date strings', async () => {
      const res = await request(app)
        .get('/api/v1/transactions')
        .query({ from: '04/01/2026', to: '2026-04-01' })
        .set(authHeader(adminToken));
      expect(res.status).toBe(400);
    });
  });

  describe('reports', () => {
    it('monthly report with from/to matches year+month for the same month', async () => {
      const customer = await createCustomer('Month Range Customer');
      await intake({ sourceType: 'customer', customerId: customer, amount: 5000, date: '2026-07-01' });
      await intake({ sourceType: 'customer', customerId: customer, amount: 6000, date: '2026-07-31' });
      await intake({ sourceType: 'customer', customerId: customer, amount: 7000, date: '2026-08-01' });

      const byMonth = await request(app)
        .get('/api/v1/reports/monthly')
        .query({ year: 2026, month: 7 })
        .set(authHeader(adminToken));
      expect(byMonth.status).toBe(200);

      const byRange = await request(app)
        .get('/api/v1/reports/monthly')
        .query({ from: '2026-07-01', to: '2026-07-31' })
        .set(authHeader(adminToken));
      expect(byRange.status).toBe(200);

      expect(byRange.body.data.from).toBe('2026-07-01');
      expect(byRange.body.data.to).toBe('2026-07-31');
      expect(Number(byRange.body.data.summary.intake)).toBe(Number(byMonth.body.data.summary.intake));
      expect(byRange.body.data.summary).toEqual(byMonth.body.data.summary);
      expect(byRange.body.data.transactions.length).toBe(2);
    });

    it('rejects a monthly range with only one side', async () => {
      const res = await request(app)
        .get('/api/v1/reports/monthly')
        .query({ from: '2026-07-01' })
        .set(authHeader(adminToken));
      expect(res.status).toBe(400);
    });

    it('rejects a monthly request with neither year+month nor from/to', async () => {
      const res = await request(app)
        .get('/api/v1/reports/monthly')
        .set(authHeader(adminToken));
      expect(res.status).toBe(400);
    });

    it('rejects a category report with from > to', async () => {
      const res = await request(app)
        .get('/api/v1/reports/categories')
        .query({ from: '2026-08-01', to: '2026-07-31' })
        .set(authHeader(adminToken));
      expect(res.status).toBe(400);
    });

    it('scopes partner totals and ledger to the selected range', async () => {
      const partner = await createPartner('Range Partner');
      await intake({ sourceType: 'partner_capital', partnerId: partner, amount: 10000, date: '2026-02-10' });
      await intake({ sourceType: 'partner_capital', partnerId: partner, amount: 20000, date: '2026-04-10' });
      await intake({ sourceType: 'partner_loan', partnerId: partner, amount: 5000, date: '2026-05-10' });

      const all = await request(app)
        .get(`/api/v1/reports/partners/${partner}`)
        .set(authHeader(adminToken));
      expect(Number(all.body.data.totals.totalInflow)).toBe(35000);

      const scoped = await request(app)
        .get(`/api/v1/reports/partners/${partner}`)
        .query({ from: '2026-04-01', to: '2026-04-30' })
        .set(authHeader(adminToken));
      expect(scoped.status).toBe(200);
      expect(Number(scoped.body.data.totals.totalInflow)).toBe(20000);
      expect(Number(scoped.body.data.totals.capitalContributions)).toBe(20000);
      expect(Number(scoped.body.data.totals.loanReceipts)).toBe(0);
      expect(scoped.body.data.ledger.rows.length).toBe(1);
      expect(scoped.body.data.from).toBe('2026-04-01');
    });
  });

  describe('dashboard', () => {
    it('defaults to the current financial year period', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      const period = res.body.data.period;
      // April-start financial year containing "now" (tests run in 2026)
      const now = new Date();
      const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
      expect(period.from).toBe(`${startYear}-04-01`);
      expect(period.to).toBe(`${startYear + 1}-03-31`);
    });

    it('computes period aggregates (opening, intake, outtake, net) for a custom range', async () => {
      const customer = await createCustomer('Period Customer');
      await intake({ sourceType: 'customer', customerId: customer, amount: 50000, date: '2026-05-01' });
      await intake({ sourceType: 'customer', customerId: customer, amount: 30000, date: '2026-05-15' });
      await intake({ sourceType: 'customer', customerId: customer, amount: 90000, date: '2026-06-01' });
      const road = await categorySlugToId('road-construction');
      await outtake({ categoryId: road, amount: 20000, date: '2026-05-20' });

      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .query({ from: '2026-05-01', to: '2026-05-31' })
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      const p = res.body.data.period;
      expect(p.from).toBe('2026-05-01');
      expect(p.to).toBe('2026-05-31');
      expect(Number(p.intake)).toBe(80000);
      expect(Number(p.outtake)).toBe(20000);
      expect(Number(p.net)).toBe(60000);
      // June tx must not leak into May
      expect(p.intakeCount).toBe(2);
      // Opening = opening balance setting (0) + movements before 2026-05-01 (none here)
      expect(Number(p.openingBalance)).toBe(0);

      const june = await request(app)
        .get('/api/v1/dashboard/summary')
        .query({ from: '2026-06-01', to: '2026-06-30' })
        .set(authHeader(adminToken));
      expect(Number(june.body.data.period.intake)).toBe(90000);
      // May opening carries the May net forward: 0 + 80000 - 20000
      expect(Number(june.body.data.period.openingBalance)).toBe(60000);
    });

    it('rejects a dashboard range with only one side', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .query({ to: '2026-05-31' })
        .set(authHeader(adminToken));
      expect(res.status).toBe(400);
    });

    it('scopes the category breakdown to the range', async () => {
      const road = await categorySlugToId('road-construction');
      const labor = await categorySlugToId('labor');
      await outtake({ categoryId: road, amount: 1000, date: '2026-01-15' });
      await outtake({ categoryId: labor, amount: 2000, date: '2026-03-15' });
      await outtake({ categoryId: road, amount: 3000, date: '2026-05-15' });

      const jan = await request(app)
        .get('/api/v1/dashboard/categories')
        .query({ from: '2026-01-01', to: '2026-01-31' })
        .set(authHeader(adminToken));
      expect(Number(jan.body.data.find((c) => c.slug === 'road-construction').total_outtake)).toBe(1000);

      const may = await request(app)
        .get('/api/v1/dashboard/categories')
        .query({ from: '2026-05-01', to: '2026-05-31' })
        .set(authHeader(adminToken));
      expect(Number(may.body.data.find((c) => c.slug === 'road-construction').total_outtake)).toBe(3000);
      expect(Number(may.body.data.find((c) => c.slug === 'labor').total_outtake)).toBe(0);
    });

    it('never shares cached aggregate results across different ranges', async () => {
      const customer = await createCustomer('Cache Customer');
      await intake({ sourceType: 'customer', customerId: customer, amount: 111, date: '2026-02-05' });
      await intake({ sourceType: 'customer', customerId: customer, amount: 222, date: '2026-03-05' });

      const rangeA = { from: '2026-02-01', to: '2026-02-28' };
      const rangeB = { from: '2026-03-01', to: '2026-03-31' };

      const a1 = await request(app)
        .get('/api/v1/dashboard/summary')
        .query(rangeA)
        .set(authHeader(adminToken));
      const b = await request(app)
        .get('/api/v1/dashboard/summary')
        .query(rangeB)
        .set(authHeader(adminToken));
      const a2 = await request(app)
        .get('/api/v1/dashboard/summary')
        .query(rangeA)
        .set(authHeader(adminToken));

      expect(Number(a1.body.data.period.intake)).toBe(111);
      expect(Number(b.body.data.period.intake)).toBe(222);
      // Re-requesting range A must return range A data, never range B's.
      expect(a2.body.data.period).toEqual(a1.body.data.period);
      expect(a2.body.data.period).not.toEqual(b.body.data.period);
      // And both are cached under range-scoped keys.
      expect(cacheGet(`financial:dashboard:${rangeA.from}:${rangeA.to}`)).toBeDefined();
      expect(cacheGet(`financial:dashboard:${rangeB.from}:${rangeB.to}`)).toBeDefined();
    });

    it('create, update and reverse still invalidate the affected aggregates', async () => {
      const customer = await createCustomer('Invalidate Customer');
      const range = { from: '2026-06-01', to: '2026-06-30' };

      const created = await intake({ sourceType: 'customer', customerId: customer, amount: 5000, date: '2026-06-10' });
      const key = `financial:dashboard:${range.from}:${range.to}`;
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .query(range)
        .set(authHeader(adminToken));
      expect(Number(res.body.data.period.intake)).toBe(5000);
      expect(cacheGet(key)).toBeDefined();

      // Create another tx in the range -> cache dropped, new total reflects both.
      await intake({ sourceType: 'customer', customerId: customer, amount: 7000, date: '2026-06-11' });
      expect(cacheGet(key)).toBeUndefined();
      const afterCreate = await request(app)
        .get('/api/v1/dashboard/summary')
        .query(range)
        .set(authHeader(adminToken));
      expect(Number(afterCreate.body.data.period.intake)).toBe(12000);

      // Update the first tx -> cache dropped, total reflects the change.
      await request(app)
        .patch(`/api/v1/transactions/${created.publicId}`)
        .set(authHeader(adminToken))
        .send({ amount: 6000 });
      expect(cacheGet(key)).toBeUndefined();
      const afterUpdate = await request(app)
        .get('/api/v1/dashboard/summary')
        .query(range)
        .set(authHeader(adminToken));
      expect(Number(afterUpdate.body.data.period.intake)).toBe(13000);

      // Reverse the first tx -> cache dropped, only the un-reversed tx counts.
      await request(app)
        .post(`/api/v1/transactions/${created.publicId}/reverse`)
        .set(authHeader(adminToken))
        .send({ adminPassword: 'Admin@123', reason: 'range test' });
      expect(cacheGet(key)).toBeUndefined();
      const afterReverse = await request(app)
        .get('/api/v1/dashboard/summary')
        .query(range)
        .set(authHeader(adminToken));
      expect(Number(afterReverse.body.data.period.intake)).toBe(7000);
    });
  });
});