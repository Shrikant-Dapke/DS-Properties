import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import LoanReceived from '../models/LoanReceived.js';
import { syncTransaction, runInTransaction } from './finance.service.js';
import { AppError } from '../utils/errors.js';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

function toDecimal128(value) {
  return mongoose.Types.Decimal128.fromString(new Decimal(value).toString());
}

function parseAmount(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new AppError('Amount is required', 400);
  }
  let amount;
  try {
    amount = new Decimal(String(raw).trim());
  } catch {
    throw new AppError('Invalid amount', 400);
  }
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppError('Amount must be greater than zero', 400);
  }
  return amount;
}

function parseDate(raw) {
  if (!raw) throw new AppError('Date is required', 400);
  const date = new Date(raw);
  if (isNaN(date.getTime())) throw new AppError('Invalid date', 400);
  return date;
}

export async function createLoan(body) {
  if (!body.lender || !String(body.lender).trim()) {
    throw new AppError('Lender / source is required', 400);
  }
  const amount = parseAmount(body.amount);
  const date = parseDate(body.date);

  return runInTransaction(async (session) => {
    const loan = await LoanReceived.create(
      [
        {
          lender: String(body.lender).trim(),
          amount: toDecimal128(amount),
          date,
          method: METHODS.includes(body.method) ? body.method : 'Cash',
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
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (isNaN(d.getTime())) throw new AppError('Invalid dateFrom', 400);
      range.$gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (isNaN(d.getTime())) throw new AppError('Invalid dateTo', 400);
      range.$lte = d;
    }
    filter.date = range;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    LoanReceived.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limitNum),
    LoanReceived.countDocuments(filter),
  ]);

  const [sumRow] = await LoanReceived.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalAmount = sumRow && sumRow.total !== null ? new Decimal(sumRow.total.toString()) : new Decimal(0);

  return {
    items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
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
    if (body.amount !== undefined) loan.amount = toDecimal128(parseAmount(body.amount));
    if (body.date !== undefined) loan.date = parseDate(body.date);
    if (body.method !== undefined) loan.method = METHODS.includes(body.method) ? body.method : 'Cash';
    if (body.reference !== undefined) loan.reference = body.reference;
    if (body.notes !== undefined) loan.notes = body.notes;

    await loan.save({ session });
    await syncTransaction('LoanReceived', loan, { operation: 'update', session });
    return loan;
  });
}
