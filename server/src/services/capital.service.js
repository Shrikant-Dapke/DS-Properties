import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import PartnerCapital from '../models/PartnerCapital.js';
import Partner from '../models/Partner.js';
import { syncTransaction, runInTransaction } from './finance.service.js';
import { AppError } from '../utils/errors.js';
import { toDecimal128, parseAmount, parseDate, PAYMENT_METHODS } from '../utils/money.js';
import { dateRangeFilter, pageMeta } from '../utils/query.js';

export async function createCapital(body) {
  if (!body.partnerId || !mongoose.Types.ObjectId.isValid(body.partnerId)) {
    throw new AppError('Valid partnerId is required', 400);
  }
  const partner = await Partner.findById(body.partnerId);
  if (!partner) throw new AppError('Partner not found', 400);

  const amount = parseAmount(body.amount, 'Amount');
  const date = parseDate(body.date, 'Date');

  return runInTransaction(async (session) => {
    const capital = await PartnerCapital.create(
      [
        {
          partnerId: partner._id,
          amount: toDecimal128(amount),
          date,
          method: PAYMENT_METHODS.includes(body.method) ? body.method : 'Cash',
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
  const range = dateRangeFilter(dateFrom, dateTo);
  if (range) filter.date = range;

  const meta = pageMeta(page, limit, 0);

  // Aggregation pipelines are not schema-cast by Mongoose, so build a typed
  // match (partnerId as ObjectId) for the summary sum.
  const aggMatch = { ...filter };
  if (partner) aggMatch.partnerId = new mongoose.Types.ObjectId(partner);

  const [items, total] = await Promise.all([
    PartnerCapital.find(filter)
      .populate('partnerId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip(meta.skip)
      .limit(meta.limitNum),
    PartnerCapital.countDocuments(filter),
  ]);
  meta.total = total;
  meta.totalPages = Math.ceil(total / meta.limitNum);

  // Total amount across the same filter (ignores pagination) for summaries.
  const [sumRow] = await PartnerCapital.aggregate([
    { $match: aggMatch },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalAmount = sumRow && sumRow.total !== null ? new Decimal(sumRow.total.toString()) : new Decimal(0);

  return {
    items,
    pagination: { page: meta.page, limit: meta.limitNum, total: meta.total, totalPages: meta.totalPages },
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
    if (body.amount !== undefined) capital.amount = toDecimal128(parseAmount(body.amount, 'Amount'));
    if (body.date !== undefined) capital.date = parseDate(body.date, 'Date');
    if (body.method !== undefined) capital.method = PAYMENT_METHODS.includes(body.method) ? body.method : 'Cash';
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
