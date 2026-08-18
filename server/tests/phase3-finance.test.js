import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { seedCategories } from '../src/services/category.service.js';
import User from '../src/models/User.js';
import Customer from '../src/models/Customer.js';
import Plot from '../src/models/Plot.js';
import Partner from '../src/models/Partner.js';
import Category from '../src/models/Category.js';
import Transaction from '../src/models/Transaction.js';
import Payment from '../src/models/Payment.js';
import Income from '../src/models/Income.js';
import Expense from '../src/models/Expense.js';
import PartnerCapital from '../src/models/PartnerCapital.js';
import LoanReceived from '../src/models/LoanReceived.js';
import { createIncome } from '../src/services/income.service.js';
import { createExpense } from '../src/services/expense.service.js';
import { createPayment } from '../src/services/payment.service.js';
import { createCapital } from '../src/services/capital.service.js';
import { createLoan } from '../src/services/loan.service.js';
import { runBackfill } from '../src/scripts/backfillFinance.js';
import { signToken } from '../src/utils/jwt.js';
import bcrypt from 'bcryptjs';

const MONGO_URI = (
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27018/ds_properties?replicaSet=rs0'
).replace(/\/ds_properties(\?|$)/, '/ds_properties_phase3f_test$1');

let server;
let base;
let devToken;
let partnerToken;
let incomeCatId;
let expenseCatId;
let customerId;
let plotId;
let partnerId;

async function makeUser(role, opts = {}) {
  const name = opts.name || `${role}-${Math.random().toString(36).slice(2, 7)}`;
  const user = await User.create({
    username: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: `${name}-${Date.now()}@test.dev`,
    passwordHash: bcrypt.hashSync('password123', 10),
    name,
    role,
    active: opts.active !== false,
  });
  return user;
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

before(async () => {
  await mongoose.connect(MONGO_URI);
  await seedCategories();
  const cats = await Category.find({});
  incomeCatId = cats.find((c) => c.type === 'income' && c.isSeed)._id.toString();
  expenseCatId = cats.find((c) => c.type === 'expense' && c.isSeed)._id.toString();

  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  const dev = await makeUser('developer');
  const partner = await makeUser('partner');
  devToken = signToken({ id: dev._id.toString(), role: dev.role });
  partnerToken = signToken({ id: partner._id.toString(), role: partner.role });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Transaction.deleteMany({});
  await Payment.deleteMany({});
  await Income.deleteMany({});
  await Expense.deleteMany({});
  await PartnerCapital.deleteMany({});
  await LoanReceived.deleteMany({});
  await Customer.deleteMany({});
  await Plot.deleteMany({});
  await Partner.deleteMany({});
});

async function seedFinanceRecords() {
  const customer = await Customer.create({ name: 'Cust', phone: '+91 90000 00001' });
  const plot = await Plot.create({
    plotNumber: 'P-FIN',
    price: '100000',
    status: 'Allocated',
    customerId: customer._id,
  });
  const partner = await Partner.create({ name: 'Partner Fin', phone: '+91 91000 00001' });
  customerId = customer._id.toString();
  plotId = plot._id.toString();
  partnerId = partner._id.toString();

  await createIncome({ amount: '5000', date: '2024-02-02', categoryId: incomeCatId, description: 'A' });
  await createIncome({ amount: '3000', date: '2024-05-05', categoryId: incomeCatId, description: 'B' });
  await createExpense({ amount: '1500', date: '2024-03-03', categoryId: expenseCatId, description: 'Ops' });
  await createPayment({ customerId, plotId, amount: '20000', date: '2024-04-04', method: 'Cash' });
  await createCapital({ partnerId, amount: '25000', date: '2024-06-06', method: 'Bank Transfer' });
  await createLoan({ lender: 'Bank XYZ', amount: '40000', date: '2024-07-07', method: 'Bank Transfer' });
}

test('GET /api/finance/transactions without token returns 401', async () => {
  const res = await req('GET', '/api/finance/transactions');
  assert.equal(res.status, 401);
});

test('partner token can read finance (authorization)', async () => {
  const res = await req('GET', '/api/finance/transactions', { token: partnerToken });
  assert.equal(res.status, 200);
});

test('empty state returns zero totals and empty items', async () => {
  const res = await req('GET', '/api/finance/transactions', { token: devToken });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.items.length, 0);
  assert.equal(res.data.data.totals.in, '0');
  assert.equal(res.data.data.totals.out, '0');
});

test('amount is serialized as a string (no float precision loss)', async () => {
  await seedFinanceRecords();
  const res = await req('GET', '/api/finance/transactions', { token: devToken });
  assert.equal(res.status, 200);
  for (const txn of res.data.data.items) {
    assert.equal(typeof txn.amount, 'string');
  }
});

test('date range filter works', async () => {
  await seedFinanceRecords();
  const res = await req('GET', '/api/finance/transactions?dateFrom=2024-03-01', { token: devToken });
  assert.equal(res.status, 200);
  const dates = res.data.data.items.map((t) => t.date.split('T')[0]);
  for (const d of dates) assert.ok(d >= '2024-03-01');
  assert.ok(res.data.data.items.length < 6);
});

test('sourceType filter works', async () => {
  await seedFinanceRecords();
  const res = await req('GET', '/api/finance/transactions?sourceType=income', { token: devToken });
  assert.equal(res.status, 200);
  assert.ok(res.data.data.items.length >= 1);
  for (const t of res.data.data.items) assert.equal(t.sourceType, 'income');
});

test('customer filter works', async () => {
  await seedFinanceRecords();
  const res = await req('GET', `/api/finance/transactions?customer=${customerId}`, { token: devToken });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.items.length, 1);
  assert.equal(res.data.data.items[0].customerId._id.toString(), customerId);
});

test('partner filter works', async () => {
  await seedFinanceRecords();
  const res = await req('GET', `/api/finance/transactions?partner=${partnerId}`, { token: devToken });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.items.length, 1);
  assert.equal(res.data.data.items[0].partnerId._id.toString(), partnerId);
});

test('category filter works', async () => {
  await seedFinanceRecords();
  const res = await req('GET', `/api/finance/transactions?category=${incomeCatId}`, { token: devToken });
  assert.equal(res.status, 200);
  for (const t of res.data.data.items) assert.equal(t.categoryId._id.toString(), incomeCatId);
});

test('pagination returns a bounded page and total counts', async () => {
  await seedFinanceRecords();
  const res = await req('GET', '/api/finance/transactions?page=1&limit=2', { token: devToken });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.items.length, 2);
  assert.ok(res.data.data.pagination.total >= 6);
  assert.ok(res.data.data.pagination.totalPages >= 3);
});

test('summary breakdown preserves income/capital/loan as distinct sources', async () => {
  await seedFinanceRecords();
  const res = await req('GET', '/api/finance/summary', { token: devToken });
  assert.equal(res.status, 200);
  const by = res.data.data.bySourceType;
  // Distinct source types must not be merged into a single "revenue" bucket.
  assert.ok(by.income && Number(by.income.in) > 0);
  assert.ok(by.capital && Number(by.capital.in) > 0);
  assert.ok(by.loan && Number(by.loan.in) > 0);
  assert.ok(by.payment && Number(by.payment.in) > 0);
  assert.ok(by.expense && Number(by.expense.out) > 0);
  // Loan is cash-in but must NOT be merged into income/capital.
  assert.notEqual(by.loan, by.income);
  // Totals reflect direction: in = payments + income + capital + loan; out = expenses.
  assert.ok(Number(res.data.data.totals.in) > 0);
  assert.ok(Number(res.data.data.totals.out) > 0);
});

test('backfill is idempotent (second run creates no duplicates)', async () => {
  // Seed source records WITHOUT ledger (bypassing the write-through services).
  const customer = await Customer.create({ name: 'Cust B', phone: '+91 90000 00002' });
  const plot = await Plot.create({
    plotNumber: 'P-BF',
    price: '50000',
    status: 'Allocated',
    customerId: customer._id,
  });
  const partner = await Partner.create({ name: 'Partner B', phone: '+91 91000 00002' });
  const cats = await Category.find({});
  const inc = cats.find((c) => c.type === 'income' && c.isSeed)._id;
  const exp = cats.find((c) => c.type === 'expense' && c.isSeed)._id;

  await Payment.create({
    customerId: customer._id,
    plotId: plot._id,
    amount: mongoose.Types.Decimal128.fromString('10000'),
    date: new Date('2024-04-04'),
    method: 'Cash',
  });
  await Income.create({
    amount: mongoose.Types.Decimal128.fromString('5000'),
    date: new Date('2024-04-04'),
    categoryId: inc,
  });
  await Expense.create({
    amount: mongoose.Types.Decimal128.fromString('1500'),
    date: new Date('2024-04-04'),
    categoryId: exp,
    deleted: false,
  });
  await PartnerCapital.create({
    partnerId: partner._id,
    amount: mongoose.Types.Decimal128.fromString('25000'),
    date: new Date('2024-04-04'),
    method: 'Bank Transfer',
  });
  await LoanReceived.create({
    lender: 'Lender B',
    amount: mongoose.Types.Decimal128.fromString('40000'),
    date: new Date('2024-04-04'),
    method: 'Bank Transfer',
  });

  const first = await runBackfill();
  assert.equal(await Transaction.find().countDocuments(), 5);

  // Unique index guards against duplicates; a second run must change nothing.
  await runBackfill();
  assert.equal(await Transaction.find().countDocuments(), 5);
});
