import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { signToken } from '../src/utils/jwt.js';
import { seedCategories } from '../src/services/category.service.js';
import User from '../src/models/User.js';
import Customer from '../src/models/Customer.js';
import Plot from '../src/models/Plot.js';
import Category from '../src/models/Category.js';
import Transaction from '../src/models/Transaction.js';
import Payment from '../src/models/Payment.js';
import Income from '../src/models/Income.js';
import Expense from '../src/models/Expense.js';
import PartnerCapital from '../src/models/PartnerCapital.js';
import LoanReceived from '../src/models/LoanReceived.js';
import ChangeRequest from '../src/models/ChangeRequest.js';
import AuditLog from '../src/models/AuditLog.js';
import bcrypt from 'bcryptjs';

const MONGO_URI = (
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27018/ds_properties?replicaSet=rs0'
).replace(/\/ds_properties(\?|$)/, '/ds_properties_phase3_test$1');

let server;
let base;
let incomeCatId;
let expenseCatId;

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
  const token = signToken({ sub: user._id.toString(), role: user.role });
  return { user, token };
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

before(async () => {
  await mongoose.connect(MONGO_URI);
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  await seedCategories();
  const cats = await Category.find({});
  incomeCatId = cats.find((c) => c.type === 'income' && c.isSeed)._id.toString();
  expenseCatId = cats.find((c) => c.type === 'expense' && c.isSeed)._id.toString();
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
  await ChangeRequest.deleteMany({});
  await AuditLog.deleteMany({});
  await User.deleteMany({});
});

test('developer payment write-through creates a ledger transaction (in)', async () => {
  const { token } = await makeUser('developer');
  const customer = await Customer.create({ name: 'C', phone: '+91 90000 00000' });
  const plot = await Plot.create({
    plotNumber: 'P1',
    price: '500000',
    status: 'Allocated',
    customerId: customer._id,
  });

  const pay = await req('POST', '/api/payments', {
    token,
    body: {
      customerId: customer._id.toString(),
      plotId: plot._id.toString(),
      amount: '100000',
      date: '2024-01-01',
      method: 'Cash',
    },
  });
  assert.equal(pay.status, 201);

  const list = await req('GET', '/api/finance/transactions', { token });
  assert.equal(list.status, 200);
  assert.equal(list.data.data.items.length, 1);
  const tx = list.data.data.items[0];
  assert.equal(tx.sourceType, 'payment');
  assert.equal(tx.direction, 'in');
  assert.equal(tx.customerId._id, customer._id.toString());
  assert.equal(tx.plotId._id, plot._id.toString());

  const summary = await req('GET', '/api/finance/summary', { token });
  assert.equal(summary.data.data.totals.in, '100000');
  assert.equal(summary.data.data.totals.out, '0');
});

test('income (in) and expense (out) write-through with correct directions', async () => {
  const { token } = await makeUser('developer');

  const inc = await req('POST', '/api/income', {
    token,
    body: {
      amount: '5000',
      date: '2024-02-02',
      categoryId: incomeCatId,
      description: 'Resale profit',
    },
  });
  assert.equal(inc.status, 201);

  const exp = await req('POST', '/api/expenses', {
    token,
    body: {
      amount: '2000',
      date: '2024-02-03',
      categoryId: expenseCatId,
      description: 'Legal fee',
    },
  });
  assert.equal(exp.status, 201);

  const inRes = await req('GET', '/api/finance/money-in', { token });
  assert.equal(inRes.data.data.items.length, 1);
  assert.equal(inRes.data.data.items[0].sourceType, 'income');

  const outRes = await req('GET', '/api/finance/money-out', { token });
  assert.equal(outRes.data.data.items.length, 1);
  assert.equal(outRes.data.data.items[0].sourceType, 'expense');
  assert.equal(outRes.data.data.items[0].categoryId._id, expenseCatId);

  const summary = await req('GET', '/api/finance/summary', { token });
  assert.equal(summary.data.data.totals.in, '5000');
  assert.equal(summary.data.data.totals.out, '2000');
  assert.equal(summary.data.data.totals.net, '3000');
});

test('date and sourceType filters work', async () => {
  const { token } = await makeUser('developer');
  await req('POST', '/api/income', {
    token,
    body: { amount: '1000', date: '2024-01-10', categoryId: incomeCatId },
  });
  await req('POST', '/api/income', {
    token,
    body: { amount: '1000', date: '2025-06-10', categoryId: incomeCatId },
  });

  const filtered = await req(
    'GET',
    '/api/finance/transactions?sourceType=income&dateFrom=2025-01-01',
    { token }
  );
  assert.equal(filtered.data.data.items.length, 1);
  const summary = await req('GET', '/api/finance/summary', { token });
  assert.equal(summary.data.data.totals.in, '2000');
});

test('expense soft-delete removes its ledger transaction', async () => {
  const { token } = await makeUser('developer');
  const exp = await req('POST', '/api/expenses', {
    token,
    body: {
      amount: '3000',
      date: '2024-03-03',
      categoryId: expenseCatId,
      description: 'Labor',
    },
  });
  const id = exp.data.data._id;

  let list = await req('GET', '/api/finance/transactions?sourceType=expense', { token });
  assert.equal(list.data.data.items.length, 1);

  const del = await req('DELETE', `/api/expenses/${id}`, { token });
  assert.equal(del.status, 200);

  list = await req('GET', '/api/finance/transactions?sourceType=expense', { token });
  assert.equal(list.data.data.items.length, 0);
});

test('partner change-request commit writes a ledger transaction', async () => {
  const { token: p1Token } = await makeUser('partner', { name: 'P1' });
  const { token: p2Token } = await makeUser('partner', { name: 'P2' });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Income',
      operation: 'create',
      changes: [
        { field: 'amount', newValue: '7500' },
        { field: 'date', newValue: '2024-04-04' },
        { field: 'categoryId', newValue: incomeCatId },
        { field: 'description', newValue: 'Partner income' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const crId = created.data.data._id;

  // Partner 2 (the only other active partner) approves -> commit.
  const approve = await req('POST', `/api/change-requests/${crId}/approve`, {
    token: p2Token,
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.data.data.status, 'COMMITTED');

  const list = await req('GET', '/api/finance/transactions?sourceType=income', {
    token: p1Token,
  });
  assert.equal(list.data.data.items.length, 1);
  assert.equal(list.data.data.items[0].amount, '7500');

  // Confirm the source Income record actually exists.
  const incomes = await Income.find();
  assert.equal(incomes.length, 1);
});
