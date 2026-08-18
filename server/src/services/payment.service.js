import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import Payment from '../models/Payment.js';
import Plot from '../models/Plot.js';
import Customer from '../models/Customer.js';
import { syncTransaction, runInTransaction } from './finance.service.js';
import { AppError } from '../utils/errors.js';
import { toDecimal128, parseAmount, parseDate, PAYMENT_METHODS } from '../utils/money.js';
import { dateRangeFilter, pageMeta } from '../utils/query.js';

export async function sumPlotPaid(plotId, session) {
  const agg = Payment.aggregate([
    { $match: { plotId } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  if (session) agg.session(session);
  const [row] = await agg;
  if (!row || row.total === null || row.total === undefined) return new Decimal(0);
  // row.total is a Decimal128; convert via string to avoid any JS Number coercion.
  return new Decimal(row.total.toString());
}

export async function createPayment(body) {
  if (!body.customerId || !mongoose.Types.ObjectId.isValid(body.customerId)) {
    throw new AppError('Valid customerId is required', 400);
  }
  if (!body.plotId || !mongoose.Types.ObjectId.isValid(body.plotId)) {
    throw new AppError('Valid plotId is required', 400);
  }
  const amount = parseAmount(body.amount, 'Payment amount');
  const date = parseDate(body.date, 'Payment date');

  return runInTransaction(async (session) => {
    const customer = await Customer.findById(body.customerId).session(session);
    if (!customer) throw new AppError('Customer not found', 400);

    const plot = await Plot.findById(body.plotId).session(session);
    if (!plot) throw new AppError('Plot not found', 400);

    if (!plot.customerId) {
      throw new AppError('Cannot record payment for an unassigned plot', 400);
    }
    if (plot.customerId.toString() !== String(body.customerId)) {
      throw new AppError('Payment customer does not match the plot customer', 400);
    }

    const price = new Decimal(plot.price.toString());
    const paid = await sumPlotPaid(plot._id, session);
    const remaining = price.minus(paid);

    if (amount.gt(remaining)) {
      throw new AppError(
        `Payment exceeds remaining outstanding of ${remaining.toString()}`,
        409
      );
    }

    const payment = await Payment.create(
      [
        {
          customerId: plot.customerId,
          plotId: plot._id,
          amount: toDecimal128(amount),
          date,
          method: PAYMENT_METHODS.includes(body.method) ? body.method : 'Cash',
          reference: body.reference || undefined,
          notes: body.notes || undefined,
        },
      ],
      { session }
    );

    await syncTransaction('Payment', payment[0], { operation: 'create', session });
    return payment[0];
  });
}

export async function listPayments({
  customer,
  plot,
  method,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
} = {}) {
  const filter = {};

  if (customer) {
    if (!mongoose.Types.ObjectId.isValid(customer)) {
      throw new AppError('Invalid customer filter', 400);
    }
    filter.customerId = customer;
  }
  if (plot) {
    if (!mongoose.Types.ObjectId.isValid(plot)) {
      throw new AppError('Invalid plot filter', 400);
    }
    filter.plotId = plot;
  }
  if (method) filter.method = method;

  const range = dateRangeFilter(dateFrom, dateTo);
  if (range) filter.date = range;

  const meta = pageMeta(page, limit, 0);

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('customerId', 'name')
      .populate('plotId', 'plotNumber')
      .sort({ date: -1, createdAt: -1 })
      .skip(meta.skip)
      .limit(meta.limitNum),
    Payment.countDocuments(filter),
  ]);
  meta.total = total;
  meta.totalPages = Math.ceil(total / meta.limitNum);

  return {
    items,
    pagination: {
      page: meta.page,
      limit: meta.limitNum,
      total: meta.total,
      totalPages: meta.totalPages,
    },
  };
}

export async function getPayment(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid payment id', 400);
  const payment = await Payment.findById(id)
    .populate('customerId', 'name')
    .populate('plotId', 'plotNumber');
  if (!payment) throw new AppError('Payment not found', 404);
  return payment;
}
