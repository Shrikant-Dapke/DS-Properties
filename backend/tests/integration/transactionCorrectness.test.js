import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import { query, withTransaction } from '../../src/config/database.js';
import { createTransaction, reverseTransaction as modelReverse } from '../../src/models/transactionModel.js';
import { getAdminToken, authHeader, setupPartnerQuorum, proposeAndApprove, proposeAsPartner } from '../helpers/api.js';

const PARTNER_PW = 'Test@1234';

function uniq(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

describe('P1 dispatch/atomicity + query correctness (via partner governance)', () => {
  let adminToken;
  let adminId;
  let Q;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    Q = await setupPartnerQuorum(adminToken, 2, 'atom');
    const { rows } = await pool.query(`SELECT id FROM users WHERE username = 'admin'`);
    adminId = rows[0].id;
  });

  async function createCustomer(name) {
    const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/customers', { name });
    return entity.publicId;
  }

  async function createPartner(name) {
    const res = await request(app)
      .post('/api/v1/partners')
      .set(authHeader(adminToken))
      .send({ name });
    expect(res.status).toBe(201);
    return res.body.data.entity.publicId;
  }

  async function createIntake({ customerPublicId, partnerPublicId, amount = 1000, date, referenceNumber }) {
    const body = {
      transactionType: 'intake',
      sourceType: customerPublicId ? 'customer' : 'partner_capital',
      amount,
      paymentMode: 'cash',
      transactionDate: date,
    };
    if (customerPublicId) body.customerPublicId = customerPublicId;
    if (partnerPublicId) body.partnerPublicId = partnerPublicId;
    if (referenceNumber) body.referenceNumber = referenceNumber;
    const { entity } = await proposeAndApprove(Q, 'post', '/api/v1/transactions', body);
    return entity;
  }

  async function deleteTx(publicId, extra = {}) {
    const { changeRequest } = await proposeAndApprove(Q, 'delete', `/api/v1/transactions/${publicId}`, {
      adminPassword: PARTNER_PW,
      reason: 'p1 check',
      ...extra,
    });
    return changeRequest;
  }

  async function reverseTx(publicId, extra = {}) {
    const { entity, changeRequest } = await proposeAndApprove(Q, 'post', `/api/v1/transactions/${publicId}/reverse`, {
      adminPassword: PARTNER_PW,
      reason: 'p1 check',
      ...extra,
    });
    return { entity, changeRequest };
  }

  async function internalIds(customerPublicId) {
    const c = await pool.query('SELECT id FROM customers WHERE public_id = $1', [customerPublicId]);
    return { customerId: c.rows[0].id };
  }

  describe('listTransactions search count (customer/partner JOINs)', () => {
    it('search by customer name returns 200 with consistent count', async () => {
      const name = uniq('AtomicCust');
      const customerPublicId = await createCustomer(name);
      const ref = uniq('ATOMIC-CUST-REF');
      const tx = await createIntake({ customerPublicId, amount: 1234, date: '2026-09-10', referenceNumber: ref });

      const res = await request(app)
        .get('/api/v1/transactions')
        .query({ search: name, limit: 100 })
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
      expect(res.body.data.rows.some((r) => r.publicId === tx.publicId)).toBe(true);
      // Unique-name search isolates our row: count must equal rows returned.
      expect(res.body.data.pagination.total).toBe(res.body.data.rows.length);
    });

    it('search by partner name returns 200 with consistent count', async () => {
      const name = uniq('AtomicPartner');
      const partnerPublicId = await createPartner(name);
      const tx = await createIntake({ partnerPublicId, amount: 4321, date: '2026-09-10' });

      const res = await request(app)
        .get('/api/v1/transactions')
        .query({ search: name, limit: 100 })
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
      expect(res.body.data.rows.some((r) => r.publicId === tx.publicId)).toBe(true);
      expect(res.body.data.pagination.total).toBe(res.body.data.rows.length);
    });
  });

  describe('deleted / reversed / reversal exclusion consistency', () => {
    it('deleted rows are excluded from daily, monthly, recent, and ledgers with agreeing counts', async () => {
      const date = '2026-09-20';
      const customerPublicId = await createCustomer(uniq('DelLedgerCust'));
      const ref = uniq('DEL-REF');
      const tx = await createIntake({ customerPublicId, amount: 5000, date, referenceNumber: ref });

      // Sanity: visible before delete.
      const dailyBefore = await request(app).get('/api/v1/reports/daily').query({ date }).set(authHeader(adminToken));
      expect(dailyBefore.status).toBe(200);
      expect(dailyBefore.body.data.transactions.some((t) => t.publicId === tx.publicId)).toBe(true);

      const cr = await deleteTx(tx.publicId, { reason: 'p1 exclusion check' });
      expect(cr.status).toBe('APPROVED');

      const search = await request(app)
        .get('/api/v1/transactions')
        .query({ search: ref, limit: 100 })
        .set(authHeader(adminToken));
      expect(search.status).toBe(200);
      expect(search.body.data.pagination.total).toBe(0);
      expect(search.body.data.rows.length).toBe(0);

      const daily = await request(app).get('/api/v1/reports/daily').query({ date }).set(authHeader(adminToken));
      expect(daily.status).toBe(200);
      expect(daily.body.data.transactions.some((t) => t.publicId === tx.publicId)).toBe(false);

      const monthly = await request(app)
        .get('/api/v1/reports/monthly')
        .query({ from: date, to: date })
        .set(authHeader(adminToken));
      expect(monthly.status).toBe(200);
      expect(monthly.body.data.transactions.some((t) => t.publicId === tx.publicId)).toBe(false);

      const ledger = await request(app)
        .get(`/api/v1/customers/${customerPublicId}/ledger`)
        .query({ limit: 100 })
        .set(authHeader(adminToken));
      expect(ledger.status).toBe(200);
      expect(ledger.body.data.pagination.total).toBe(ledger.body.data.rows.length);
      // Customer-ledger rows are raw model rows (snake_case public_id).
      expect(ledger.body.data.rows.some((t) => (t.publicId ?? t.public_id) === tx.publicId)).toBe(false);

      const dash = await request(app)
        .get('/api/v1/dashboard/summary')
        .query({ from: date, to: date })
        .set(authHeader(adminToken));
      expect(dash.status).toBe(200);
      expect((dash.body.data.recentTransactions || []).some((t) => t.publicId === tx.publicId)).toBe(false);
    });

    it('reversed originals and reversal offsets are excluded from daily, monthly, recent, and ledgers', async () => {
      const date = '2026-09-21';
      const customerPublicId = await createCustomer(uniq('RevLedgerCust'));
      const ref = uniq('REV-REF');
      const tx = await createIntake({ customerPublicId, amount: 6000, date, referenceNumber: ref });

      const { entity, changeRequest } = await reverseTx(tx.publicId, { reason: 'p1 reversal check' });
      expect(changeRequest.status).toBe('APPROVED');
      const reversalPublicId = entity?.reversalPublicId;
      expect(reversalPublicId).toBeTruthy();

      const daily = await request(app).get('/api/v1/reports/daily').query({ date }).set(authHeader(adminToken));
      expect(daily.status).toBe(200);
      expect(daily.body.data.transactions.some((t) => t.publicId === tx.publicId)).toBe(false);
      expect(daily.body.data.transactions.some((t) => t.publicId === reversalPublicId)).toBe(false);

      const monthly = await request(app)
        .get('/api/v1/reports/monthly')
        .query({ from: date, to: date })
        .set(authHeader(adminToken));
      expect(monthly.status).toBe(200);
      const ids = monthly.body.data.transactions.map((t) => t.publicId);
      expect(ids).not.toContain(tx.publicId);
      expect(ids).not.toContain(reversalPublicId);

      const ledger = await request(app)
        .get(`/api/v1/customers/${customerPublicId}/ledger`)
        .query({ limit: 100 })
        .set(authHeader(adminToken));
      expect(ledger.status).toBe(200);
      expect(ledger.body.data.pagination.total).toBe(ledger.body.data.rows.length);
      expect(ledger.body.data.rows.some((t) => (t.publicId ?? t.public_id) === tx.publicId)).toBe(false);
      expect(ledger.body.data.rows.some((t) => (t.publicId ?? t.public_id) === reversalPublicId)).toBe(false);

      const dash = await request(app)
        .get('/api/v1/dashboard/summary')
        .query({ from: date, to: date })
        .set(authHeader(adminToken));
      expect(dash.status).toBe(200);
      const recentIds = (dash.body.data.recentTransactions || []).map((t) => t.publicId);
      expect(recentIds).not.toContain(tx.publicId);
      expect(recentIds).not.toContain(reversalPublicId);
    });

    it('counts agree with rows under mixed active/deleted/reversed state', async () => {
      const date = '2026-09-22';
      const customerPublicId = await createCustomer(uniq('MixCust'));
      const active = await createIntake({ customerPublicId, amount: 100, date, referenceNumber: uniq('MIX-ACT') });
      const doomed = await createIntake({ customerPublicId, amount: 200, date, referenceNumber: uniq('MIX-DEL') });
      const doomedRev = await createIntake({ customerPublicId, amount: 300, date, referenceNumber: uniq('MIX-REV') });

      await deleteTx(doomed.publicId, { reason: 'mix' });
      await reverseTx(doomedRev.publicId, { reason: 'mix' });

      const daily = await request(app).get('/api/v1/reports/daily').query({ date }).set(authHeader(adminToken));
      expect(daily.body.data.transactions.map((t) => t.publicId)).toEqual([active.publicId]);

      const monthly = await request(app)
        .get('/api/v1/reports/monthly')
        .query({ from: date, to: date })
        .set(authHeader(adminToken));
      expect(monthly.body.data.transactions.map((t) => t.publicId)).toEqual([active.publicId]);

      const ledger = await request(app)
        .get(`/api/v1/customers/${customerPublicId}/ledger`)
        .query({ limit: 100 })
        .set(authHeader(adminToken));
      expect(ledger.body.data.pagination.total).toBe(1);
      // Customer-ledger rows are raw model rows (snake_case public_id).
      expect(ledger.body.data.rows.map((t) => t.publicId ?? t.public_id)).toEqual([active.publicId]);
    });
  });

  describe('rollback atomicity (outer ROLLBACK rolls back entity mutation)', () => {
    it('createTransaction joined to an outer transaction rolls back on outer failure', async () => {
      const customerPublicId = await createCustomer(uniq('RollbackCust'));
      const { customerId } = await internalIds(customerPublicId);
      const ref = uniq('ROLLBACK-REF');

      const before = await pool.query('SELECT count(*)::int AS n FROM transactions WHERE reference_number = $1', [ref]);
      expect(before.rows[0].n).toBe(0);

      await expect(
        withTransaction(async () => {
          await createTransaction({
            transaction_type: 'intake',
            source_type: 'customer',
            customer_id: customerId,
            partner_id: null,
            expense_category_id: null,
            amount: 777.77,
            payment_mode: 'cash',
            transaction_date: '2026-09-23',
            reference_number: ref,
            plot_number: null,
            paid_to: null,
            description: 'rollback probe',
            created_by: adminId,
          });
          throw new Error('forced outer failure');
        }),
      ).rejects.toThrow('forced outer failure');

      const after = await pool.query('SELECT count(*)::int AS n FROM transactions WHERE reference_number = $1', [ref]);
      expect(after.rows[0].n).toBe(0);
    });

    it('forced audit failure leaves no orphan transaction row', async () => {
      const customerPublicId = await createCustomer(uniq('AuditFailCust'));
      const { customerId } = await internalIds(customerPublicId);
      const ref = uniq('AUDITFAIL-REF');

      await expect(
        withTransaction(async () => {
          await createTransaction({
            transaction_type: 'intake',
            source_type: 'customer',
            customer_id: customerId,
            partner_id: null,
            expense_category_id: null,
            amount: 888.88,
            payment_mode: 'cash',
            transaction_date: '2026-09-23',
            reference_number: ref,
            plot_number: null,
            paid_to: null,
            description: 'audit-fail probe',
            created_by: adminId,
          });
          // Simulate the audit insert failing (NOT NULL violation) after the
          // entity write but inside the same outer transaction.
          await query('INSERT INTO audit_logs (user_id, action, domain) VALUES ($1, NULL, $2)', [adminId, 'transactions']);
        }),
      ).rejects.toThrow();

      const after = await pool.query('SELECT count(*)::int AS n FROM transactions WHERE reference_number = $1', [ref]);
      expect(after.rows[0].n).toBe(0);
    });

    it('reverseTransaction joined to an outer transaction rolls back flag + offset row together', async () => {
      const customerPublicId = await createCustomer(uniq('RollbackRevCust'));
      const tx = await createIntake({ customerPublicId, amount: 999, date: '2026-09-24', referenceNumber: uniq('RB-REV') });
      const idRow = await pool.query('SELECT id FROM transactions WHERE public_id = $1', [tx.publicId]);
      const internalId = idRow.rows[0].id;

      await expect(
        withTransaction(async () => {
          const r = await modelReverse(internalId, { userId: adminId, reason: 'rollback probe' });
          expect(r.reversalPublicId).toBeTruthy();
          throw new Error('forced reverse rollback');
        }),
      ).rejects.toThrow('forced reverse rollback');

      const check = await pool.query('SELECT reversed_at FROM transactions WHERE public_id = $1', [tx.publicId]);
      expect(check.rows[0].reversed_at).toBeNull();
      const orphans = await pool.query('SELECT count(*)::int AS n FROM transactions WHERE reversed_from_id = $1', [internalId]);
      expect(orphans.rows[0].n).toBe(0);
    });
  });

  describe('version/concurrency for governed destructive ops', () => {
    it('DELETE without a version tag is accepted as a governed proposal', async () => {
      const customerPublicId = await createCustomer(uniq('NoTagCust'));
      const tx = await createIntake({ customerPublicId, amount: 111, date: '2026-09-25' });
      const res = await proposeAsPartner(Q, 'delete', `/api/v1/transactions/${tx.publicId}`, {
        adminPassword: PARTNER_PW,
        reason: 'no tag',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.changeRequest.status).toBe('PENDING');
    });

    it('DELETE with a stale version tag is rejected with STALE_CONFLICT', async () => {
      const customerPublicId = await createCustomer(uniq('StaleDelCust'));
      const tx = await createIntake({ customerPublicId, amount: 222, date: '2026-09-25' });
      const res = await proposeAsPartner(Q, 'delete', `/api/v1/transactions/${tx.publicId}`, {
        adminPassword: PARTNER_PW,
        reason: 'stale',
        versionTag: '1970-01-01T00:00:00.000Z',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('STALE_CONFLICT');
    });

    it('DELETE with the fresh version tag is approved and applied', async () => {
      const customerPublicId = await createCustomer(uniq('FreshDelCust'));
      const tx = await createIntake({ customerPublicId, amount: 333, date: '2026-09-25' });
      const row = await pool.query('SELECT updated_at FROM transactions WHERE public_id = $1', [tx.publicId]);
      const fresh = row.rows[0].updated_at instanceof Date ? row.rows[0].updated_at.toISOString() : String(row.rows[0].updated_at);
      const { changeRequest } = await proposeAndApprove(Q, 'delete', `/api/v1/transactions/${tx.publicId}`, {
        adminPassword: PARTNER_PW,
        reason: 'fresh',
        versionTag: fresh,
      });
      expect(changeRequest.status).toBe('APPROVED');
    });

    it('reverse with a stale version tag is rejected with STALE_CONFLICT', async () => {
      const customerPublicId = await createCustomer(uniq('StaleRevCust'));
      const tx = await createIntake({ customerPublicId, amount: 444, date: '2026-09-26' });
      const res = await proposeAsPartner(Q, 'post', `/api/v1/transactions/${tx.publicId}/reverse`, {
        adminPassword: PARTNER_PW,
        reason: 'stale',
        versionTag: '1970-01-01T00:00:00.000Z',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('STALE_CONFLICT');
    });
  });
});
