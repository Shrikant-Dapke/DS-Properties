import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import PartnerCapital from '../models/PartnerCapital.js';
import Partner from '../models/Partner.js';
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

export async function createCapital(body) {
  if (!body.partnerId || !mongoose.Types.ObjectId.isValid(body.partnerId)) {
    throw new AppError('Valid partnerId is required', 400);
  }
  const partner = await Partner.findById(body.partnerId);
  if (!partner) throw new AppError('Partner not found', 400);

  const amount = parseAmount(body.amount);
  const date = parseDate(body.date);

  return runInTransaction(async (session) => {
    const capital = await PartnerCapital.create(
      [
        {
          partnerId: partner._id,
          amount: toDecimal128(amount),
          date,
          method: METHODS.includes(body.method) ? body.method : 'Cash',
          reference: body.reference || undefined,
          notes: body.notes || undefined,
        },
      ],
      { session }
    );

    const created = await PartnerCapital.findById(capital[0]._id)
      .populate('partnerId', 'name')
      .session(session);
    await syncTransaction('PartnerCapital', created, { operation: 'create', session });
    return created;
  });
}

export async function listCapital({
  partner,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
} = {}) {
  const filter = {};
  if (partner) {
    if (!mongoose.Types.ObjectId.isValid(partner)) throw new AppError('Invalid partner filter', 400);
    filter.partnerId = partner;
  }
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

  // Aggregation pipelines are not schema-cast by Mongoose, so build a typed
  // match (partnerId as ObjectId) for the summary sum.
  const aggMatch = { ...filter };
  if (partner) aggMatch.partnerId = new mongoose.Types.ObjectId(partner);

  const [items, total] = await Promise.all([
    PartnerCapital.find(filter)
      .populate('partnerId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    PartnerCapital.countDocuments(filter),
  ]);

  // Total amount across the same filter (ignores pagination) for summaries.
  const [sumRow] = await PartnerCapital.aggregate([
    { $match: aggMatch },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalAmount = sumRow && sumRow.total !== null ? new Decimal(sumRow.total.toString()) : new Decimal(0);

  return {
    items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    summary: { totalAmount: totalAmount.toString(), count: total },
  };
}

export async function getCapital(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid capital id', 400);
  const capital = await PartnerCapital.findById(id).populate('partnerId', 'name');
  if (!capital) throw new AppError('Capital contribution not found', 404);
  return capital;
}

export async function updateCapital(id, body) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid capital id', 400);

  return runInTransaction(async (session) => {
    const capital = await PartnerCapital.findById(id).session(session);
    if (!capital) throw new AppError('Capital contribution not found', 404);

    if (body.partnerId !== undefined && body.partnerId !== capital.partnerId.toString()) {
      if (!mongoose.Types.ObjectId.isValid(body.partnerId)) throw new AppError('Valid partnerId is required', 400);
      const partner = await Partner.findById(body.partnerId).session(session);
      if (!partner) throw new AppError('Partner not found', 400);
      capital.partnerId = partner._id;
    }
    if (body.amount !== undefined) capital.amount = toDecimal128(parseAmount(body.amount));
    if (body.date !== undefined) capital.date = parseDate(body.date);
    if (body.method !== undefined) capital.method = METHODS.includes(body.method) ? body.method : 'Cash';
    if (body.reference !== undefined) capital.reference = body.reference;
    if (body.notes !== undefined) capital.notes = body.notes;

    await capital.save({ session });
    const updated = await PartnerCapital.findById(capital._id)
      .populate('partnerId', 'name')
      .session(session);
    await syncTransaction('PartnerCapital', updated, { operation: 'update', session });
    return updated;
  });
}
