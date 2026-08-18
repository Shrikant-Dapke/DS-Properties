import { test } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import {
  toDecimal128,
  parseAmount,
  parseDate,
  PAYMENT_METHODS,
} from '../src/utils/money.js';
import { dateRangeFilter, pageMeta, pickFields } from '../src/utils/query.js';
import { AppError } from '../src/utils/errors.js';

function assertAppError400(fn, message) {
  let err;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof AppError, 'expected AppError');
  assert.equal(err.status, 400);
  if (message) assert.equal(err.message, message);
  return err;
}

test('toDecimal128 round-trips a number and preserves precision', () => {
  const d = toDecimal128('1234.56');
  assert.ok(mongooseDecimal128(d));
  assert.equal(d.toString(), '1234.56');
});

test('toDecimal128 accepts a Decimal instance', () => {
  assert.equal(toDecimal128(new Decimal('1.25')).toString(), '1.25');
});

test('toDecimal128 returns null for null/undefined (finance-safe superset)', () => {
  assert.equal(toDecimal128(null), null);
  assert.equal(toDecimal128(undefined), null);
});

test('parseAmount returns a Decimal for a valid value', () => {
  assert.equal(parseAmount('100', 'Expense amount').toString(), '100');
});

test('parseAmount message includes the resource label', () => {
  assertAppError400(() => parseAmount('', 'Expense amount'), 'Expense amount is required');
  assertAppError400(() => parseAmount('abc', 'Expense amount'), 'Invalid expense amount');
  assertAppError400(() => parseAmount('0', 'Expense amount'), 'Expense amount must be greater than zero');
});

test('parseAmount default label is "Amount"', () => {
  assertAppError400(() => parseAmount('', 'Amount'), 'Amount is required');
  assertAppError400(() => parseAmount('abc', 'Amount'), 'Invalid amount');
  assertAppError400(() => parseAmount('0', 'Amount'), 'Amount must be greater than zero');
});

test('parseDate returns a Date for valid input', () => {
  const d = parseDate('2020-01-01', 'Expense date');
  assert.ok(d instanceof Date);
  assert.equal(d.toISOString().slice(0, 10), '2020-01-01');
});

test('parseDate message includes the resource label', () => {
  assertAppError400(() => parseDate('', 'Expense date'), 'Expense date is required');
  assertAppError400(() => parseDate('nope', 'Expense date'), 'Invalid expense date');
});

test('PAYMENT_METHODS is the canonical method list', () => {
  assert.deepEqual(PAYMENT_METHODS, ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other']);
});

test('dateRangeFilter builds $gte/$lte and throws on invalid bounds', () => {
  const range = dateRangeFilter('2020-01-01', '2020-02-01');
  assert.ok(range.$gte instanceof Date);
  assert.ok(range.$lte instanceof Date);
  assert.equal(dateRangeFilter(undefined, undefined), null);
  assertAppError400(() => dateRangeFilter('bad', '2020-02-01'), 'Invalid dateFrom');
  assertAppError400(() => dateRangeFilter('2020-01-01', 'bad'), 'Invalid dateTo');
});

test('pageMeta clamps and computes skip/totalPages', () => {
  assert.deepEqual(pageMeta(1, 20, 45), {
    page: 1,
    limitNum: 20,
    skip: 0,
    total: 45,
    totalPages: 3,
  });
  assert.deepEqual(pageMeta(3, 20, 45), {
    page: 3,
    limitNum: 20,
    skip: 40,
    total: 45,
    totalPages: 3,
  });
  // invalid page/limit fall back to defaults
  const d = pageMeta('x', 'x', 0);
  assert.equal(d.page, 1);
  assert.equal(d.limitNum, 20);
  assert.equal(d.skip, 0);
});

test('pageMeta honors max and fallback overrides', () => {
  assert.equal(pageMeta(1, 500, 0, { max: 100 }).limitNum, 100);
  assert.equal(pageMeta(1, undefined, 0, { fallback: 25 }).limitNum, 25);
});

test('pickFields keeps only allowed, defined fields', () => {
  assert.deepEqual(pickFields({ a: 1, b: 2, c: 3 }, ['a', 'c']), { a: 1, c: 3 });
  assert.deepEqual(pickFields({ a: undefined, b: 2 }, ['a', 'b']), { b: 2 });
});

function mongooseDecimal128(v) {
  return v && typeof v.toString === 'function' && /^-?\d+(\.\d+)?$/.test(v.toString());
}
