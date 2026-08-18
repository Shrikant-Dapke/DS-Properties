import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import '../src/config/env.js';
import { seedCategories } from '../src/services/category.service.js';
import User from '../src/models/User.js';
import Customer from '../src/models/Customer.js';
import Plot from '../src/models/Plot.js';
import Partner from '../src/models/Partner.js';
import Income from '../src/models/Income.js';
import Payment from '../src/models/Payment.js';
import PartnerCapital from '../src/models/PartnerCapital.js';
import Transaction from '../src/models/Transaction.js';
import Category from '../src/models/Category.js';
import bcrypt from 'bcryptjs';

const MONGO_URI = (
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/ds_properties?replicaSet=rs0'
).replace(/\/ds_properties(\?|$)/, '/ds_properties_phase3a_test$1');

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
  return { user };
}

before(async () => {
  await mongoose.connect(MONGO_URI);
  await seedCategories();
  const cats = await Category.find({});
  incomeCatId = cats.find((c) => c.type === 'income' && c.isSeed)._id.toString();
  expenseCatId = cats.find((c) => c.type === 'expense' && c.isSeed)._id.toString();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Transaction.deleteMany({});
  await Payment.deleteMany({});
  await Income.deleteMany({});
  await PartnerCapital.deleteMany({});
  await Customer.deleteMany({});
  await Plot.deleteMany({});
  await Partner.deleteMany({});
  await User.deleteMany({});
});

test('successful source write creates both source and ledger record', async () => {
  const { createIncome } = await import('../src/services/income.service.js');
  const created = await createIncome({
    amount: '5000',
    date: '2024-02-02',
    categoryId: incomeCatId,
    description: 'Consulting',
  });
  assert.equal(created.amount.toString(), '5000');

  const incomes = await Income.find();
  const txns = await Transaction.find({ sourceType: 'income' });
  assert.equal(incomes.length, 1);
  assert.equal(txns.length, 1);
  assert.equal(txns[0].amount.toString(), '5000');
  assert.equal(txns[0].sourceId.toString(), created._id.toString());
});

test('income source + ledger roll back together on downstream failure', async () => {
  const { syncTransaction } = await import('../src/services/finance.service.js');

  const session = await mongoose.startSession();
  try {
    await assert.rejects(
      session.withTransaction(async () => {
        const income = await Income.create(
          [
            {
              amount: mongoose.Types.Decimal128.fromString('5000'),
              date: new Date('2024-02-02'),
              categoryId: incomeCatId,
              description: 'Consulting',
            },
          ],
          { session }
        );
        await syncTransaction('Income', income[0], { operation: 'create', session });
        // Simulate a failure after both writes have occurred.
        throw new Error('downstream_failure');
      })
    );
  } finally {
    await session.endSession();
  }

  // Both the source record and its ledger row must be gone after rollback.
  assert.equal(await Income.find().countDocuments(), 0);
  assert.equal(await Transaction.find().countDocuments(), 0);
});

test('source + ledger roll back together on downstream failure (atomicity)', async () => {
  await makeUser('developer');
  const customer = await Customer.create({ name: 'C', phone: '+91 90000 00000' });
  const plot = await Plot.create({
    plotNumber: 'P-ATOMIC',
    price: '100000',
    status: 'Allocated',
    customerId: customer._id,
  });

  const { syncTransaction } = await import('../src/services/finance.service.js');

  const session = await mongoose.startSession();
  try {
    await assert.rejects(
      session.withTransaction(async () => {
        const payment = await Payment.create(
          [
            {
              customerId: customer._id,
              plotId: plot._id,
              amount: mongoose.Types.Decimal128.fromString('10000'),
              date: new Date('2024-03-03'),
              method: 'Cash',
            },
          ],
          { session }
        );
        await syncTransaction('Payment', payment[0], { operation: 'create', session });
        // Simulate a failure after both writes.
        throw new Error('downstream_failure');
      })
    );
  } finally {
    await session.endSession();
  }

  // Both the source and the ledger must be gone after the rollback.
  assert.equal(await Payment.find().countDocuments(), 0);
  assert.equal(await Transaction.find().countDocuments(), 0);
});

test('capital contribution and ledger share one transaction', async () => {
  const partner = await Partner.create({ name: 'Partner A', phone: '+91 91000 00000' });
  const { createCapital } = await import('../src/services/capital.service.js');
  const created = await createCapital({
    partnerId: partner._id.toString(),
    amount: '25000',
    date: '2024-04-04',
    method: 'Bank Transfer',
  });
  assert.equal(created.amount.toString(), '25000');
  assert.equal(await PartnerCapital.find().countDocuments(), 1);
  const txns = await Transaction.find({ sourceType: 'capital' });
  assert.equal(txns.length, 1);
  assert.equal(txns[0].partnerId.toString(), partner._id.toString());
});
