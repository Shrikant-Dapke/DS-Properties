import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import LoanReceived from '../models/LoanReceived.js';
import { syncTransaction, runInTransaction } from './finance.service.js';
import { AppError } from '../utils/errors.js';
import { toDecimal128, parseAmount, parseDate, PAYMENT_METHODS } from '../utils/money.js';
import { dateRangeFilter, pageMeta } from '../utils/query.js';

export async function createLoan(body) {
  if (!body.lender || !String(body.lender).trim()) {
    throw new AppError('Lender / source is required', 400);
  }
  const amount = parseAmount(body.amount, 'Amount');
  const date = parseDate(body.date, 'Date');

  return runInTransaction(async (session) => {
    const loan = await LoanReceived.create(
      [
        {
          lender: String(body.lender).trim(),
          amount: toDecimal128(amount),
          date,
          method: PAYMENT_METHODS.includes(body.method) ? body.method : 'Cash',
          reference: body.reference || undefined,
          notes: body.notes || undefined,
        },
      ],
      { session }
    );

    await syncTransaction('LoanReceived', loan[0], { operation: 'create', session });
    return loan;
  });
}

export async function listLoans({ lender, dateFrom, dateTo, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (lender) filter.lender = { $regex: lender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const range = dateRangeFilter(dateFrom, dateTo);
  if (range) filter.date = range;

  const meta = pageMeta(page, limit, 0);

  const [items, total] = await Promise.all([
    LoanReceived.find(filter).sort({ date: -1, createdAt: -1 }).skip(meta.skip).limit(meta.limitNum),
    LoanReceived.countDocuments(filter),
  ]);
  meta.total = total;
  meta.totalPages = Math.ceil(total / meta.limitNum);

  const [sumRow] = await LoanReceived.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalAmount = sumRow && sumRow.total !== null ? new Decimal(sumRow.total.toString()) : new Decimal(0);

  return {
    items,
    pagination: { page: meta.page, limit: meta.limitNum, total: meta.total, totalPages: meta.totalPages },
    summary: { totalAmount: totalAmount.toString(), count: total },
  };
}

export async function getLoan(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid loan id', 400);
  const loan = await LoanReceived.findById(id);
  if (!loan) throw new AppError('Loan not found', 404);
  return loan;
}

export async function updateLoan(id, body) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid loan id', 400);

  return runInTransaction(async (session) => {
    const loan = await LoanReceived.findById(id).session(session);
    if (!loan) throw new AppError('Loan not found', 404);

    if (body.lender !== undefined) {
      if (!String(body.lender).trim()) throw new AppError('Lender / source is required', 400);
      loan.lender = String(body.lender).trim();
    }
    if (body.amount !== undefined) loan.amount = toDecimal128(parseAmount(body.amount, 'Amount'));
    if (body.date !== undefined) loan.date = parseDate(body.date, 'Date');
    if (body.method !== undefined) loan.method = PAYMENT_METHODS.includes(body.method) ? body.method : 'Cash';
    if (body.reference !== undefined) loan.reference = body.reference;
    if (body.notes !== undefined) loan.notes = body.notes;

    await loan.save({ session });
    await syncTransaction('LoanReceived', loan, { operation: 'update', session });
    return loan;
  });
}
