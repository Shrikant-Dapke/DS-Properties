import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import Payment from '../models/Payment.js';
import Plot from '../models/Plot.js';
import Customer from '../models/Customer.js';
import { syncTransaction, runInTransaction } from './finance.service.js';
import { AppError } from '../utils/errors.js';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

function toDecimal128(value) {
  return mongoose.Types.Decimal128.fromString(new Decimal(value).toString());
}

async function sumPlotPaid(plotId, session) {
  const payments = await Payment.find({ plotId }).session(session || null);
  let total = new Decimal(0);
  for (const p of payments) total = total.plus(new Decimal(p.amount.toString()));
  return total;
}

export async function createPayment(body) {
  if (!body.customerId || !mongoose.Types.ObjectId.isValid(body.customerId)) {
    throw new AppError('Valid customerId is required', 400);
  }
  if (!body.plotId || !mongoose.Types.ObjectId.isValid(body.plotId)) {
    throw new AppError('Valid plotId is required', 400);
  }
  if (body.amount === undefined || body.amount === null || String(body.amount).trim() === '') {
    throw new AppError('Payment amount is required', 400);
  }

  let amount;
  try {
    amount = new Decimal(String(body.amount).trim());
  } catch {
    throw new AppError('Invalid payment amount', 400);
  }
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppError('Payment amount must be greater than zero', 400);
  }

  if (!body.date) {
    throw new AppError('Payment date is required', 400);
  }
  const date = new Date(body.date);
  if (isNaN(date.getTime())) throw new AppError('Invalid payment date', 400);

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
          method: METHODS.includes(body.method) ? body.method : 'Cash',
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
    Payment.find(filter)
      .populate('customerId', 'name')
      .populate('plotId', 'plotNumber')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Payment.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
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
