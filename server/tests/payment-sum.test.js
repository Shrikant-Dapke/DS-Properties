import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import { sumPlotPaid } from '../src/services/payment.service.js';
import Payment from '../src/models/Payment.js';
import Plot from '../src/models/Plot.js';
import Customer from '../src/models/Customer.js';

const MONGO_URI = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/ds_properties?replicaSet=rs0').replace(
  /\/ds_properties(\?|$)/,
  '/ds_properties_payment_sum_test$1'
);

let customerId;
let plotA;
let plotB;

function refSum(amounts) {
  return amounts.reduce((acc, a) => acc.plus(new Decimal(a)), new Decimal(0));
}

async function seedPayments(plotId, amounts) {
  for (const a of amounts) {
    await Payment.create({ customerId, plotId, amount: a, date: new Date('2024-01-01') });
  }
}

before(async () => {
  await mongoose.connect(MONGO_URI);
});

after(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Payment.deleteMany({});
  await Plot.deleteMany({});
  await Customer.deleteMany({});
  const customer = await Customer.create({ name: 'Test Customer', phone: '+91 90000 00001' });
  customerId = customer._id;
  plotA = await Plot.create({ plotNumber: 'A1', price: '1000.00', customerId });
  plotB = await Plot.create({ plotNumber: 'B1', price: '1000.00', customerId });
});

test('sums multiple Decimal128 payments for a plot', async () => {
  const amounts = ['100.50', '200.25', '50.25'];
  await seedPayments(plotA._id, amounts);
  const total = await sumPlotPaid(plotA._id);
  assert.ok(total instanceof Decimal);
  assert.equal(total.toString(), refSum(amounts).toString());
  assert.equal(total.toString(), '351');
});

test('returns zero when no payments exist for the plot', async () => {
  const total = await sumPlotPaid(plotA._id);
  assert.ok(total instanceof Decimal);
  assert.equal(total.toString(), '0');
});

test('isolates the running total per plot', async () => {
  await seedPayments(plotA._id, ['100', '50']);
  await seedPayments(plotB._id, ['11', '22', '33']);
  const a = await sumPlotPaid(plotA._id);
  const b = await sumPlotPaid(plotB._id);
  assert.equal(a.toString(), '150');
  assert.equal(b.toString(), '66');
});

test('preserves Decimal128 precision for large and fractional values', async () => {
  const amounts = ['999999999.99', '0.01', '123456.789'];
  await seedPayments(plotA._id, amounts);
  const total = await sumPlotPaid(plotA._id);
  assert.equal(total.toString(), refSum(amounts).toString());
  assert.equal(total.toString(), '1000123456.789');
});

test('does not convert financial values through JavaScript Number (decimal-safe)', async () => {
  const amounts = ['0.1', '0.2'];
  await seedPayments(plotA._id, amounts);
  const total = await sumPlotPaid(plotA._id);
  assert.equal(total.toString(), '0.3'); // not 0.30000000000000004
});

test('matches the previous JS-loop behavior across a representative mixed dataset', async () => {
  const amounts = ['1000', '250.75', '0.25', '99999.99', '1'];
  await seedPayments(plotA._id, amounts);
  const total = await sumPlotPaid(plotA._id);
  assert.equal(total.toString(), refSum(amounts).toString());
  assert.equal(total.toString(), '101251.99');
});
