import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import Customer from '../models/Customer.js';
import Plot from '../models/Plot.js';
import Payment from '../models/Payment.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import { AppError } from '../utils/errors.js';

const PLOT_STATUSES = ['Available', 'Reserved', 'Allocated', 'Sold'];

function parseDateRange(dateFrom, dateTo) {
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
  return Object.keys(range).length ? range : null;
}

// Sum a Decimal128 field over a collection, optionally filtered. Returns a Decimal.
async function sumDecimal(model, match) {
  const pipeline = [];
  if (match && Object.keys(match).length) pipeline.push({ $match: match });
  pipeline.push({ $group: { _id: null, total: { $sum: '$amount' } } });
  const [row] = await model.aggregate(pipeline);
  if (!row || row.total === null || row.total === undefined) return new Decimal(0);
  return new Decimal(row.total.toString());
}

async function getCustomerCount() {
  return Customer.countDocuments();
}

async function getPlotStatusCounts() {
  const [statusRows, total] = await Promise.all([
    Plot.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Plot.countDocuments(),
  ]);
  const counts = { total, available: 0, reserved: 0, allocated: 0, sold: 0 };
  for (const row of statusRows) {
    if (PLOT_STATUSES.includes(row._id)) counts[row._id.toLowerCase()] = row.count;
  }
  return counts;
}

async function getReceivables() {
  // Current-state receivables: derived from agreementAmount and all payments (not date-filtered).
  const [plots, paidRows] = await Promise.all([
    Plot.find({ agreementAmount: { $ne: null } }).select('agreementAmount status'),
    Payment.aggregate([{ $group: { _id: '$plotId', paid: { $sum: '$amount' } } }]),
  ]);

  const paidByPlot = new Map();
  for (const row of paidRows) {
    paidByPlot.set(row._id.toString(), new Decimal(row.paid.toString()));
  }

  let totalOutstanding = new Decimal(0);
  let fullyPaidPlots = 0;
  let outstandingPlots = 0;

  for (const plot of plots) {
    const agreement = new Decimal(plot.agreementAmount.toString());
    const paid = paidByPlot.get(plot._id.toString()) || new Decimal(0);
    // Do not allow negative outstanding under current rules.
    const outstanding = Decimal.max(0, agreement.minus(paid));

    if (agreement.gt(0) && outstanding.eq(0)) {
      fullyPaidPlots += 1;
    } else if (outstanding.gt(0)) {
      outstandingPlots += 1;
      totalOutstanding = totalOutstanding.plus(outstanding);
    }
  }

  return {
    totalOutstanding: totalOutstanding.toString(),
    fullyPaidPlots,
    outstandingPlots,
  };
}

async function getTrends({ dateFrom, dateTo, granularity = 'month' } = {}) {
  if (granularity !== 'month') {
    throw new AppError('Only month granularity is supported', 400);
  }
  const range = parseDateRange(dateFrom, dateTo);
  const dateField = { format: '%Y-%m', date: '$date' };

  const [payments, income, expenses] = await Promise.all([
    Payment.aggregate(
      range ? [{ $match: { date: range } }, { $group: { _id: { $dateToString: dateField }, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]
             : [{ $group: { _id: { $dateToString: dateField }, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]
    ),
    Income.aggregate(
      range ? [{ $match: { date: range } }, { $group: { _id: { $dateToString: dateField }, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]
             : [{ $group: { _id: { $dateToString: dateField }, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]
    ),
    Expense.aggregate(
      range ? [{ $match: { deleted: false, date: range } }, { $group: { _id: { $dateToString: dateField }, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]
             : [{ $match: { deleted: false } }, { $group: { _id: { $dateToString: dateField }, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]
    ),
  ]);

  const byPeriod = new Map();
  const ensure = (period) => {
    if (!byPeriod.has(period)) {
      byPeriod.set(period, { period, payments: '0', income: '0', expenses: '0' });
    }
    return byPeriod.get(period);
  };

  for (const row of payments) ensure(row._id).payments = new Decimal(row.total.toString()).toString();
  for (const row of income) ensure(row._id).income = new Decimal(row.total.toString()).toString();
  for (const row of expenses) ensure(row._id).expenses = new Decimal(row.total.toString()).toString();

  return Array.from(byPeriod.values());
}

async function getRecentActivity(limit = 5) {
  const [payments, income, expenses] = await Promise.all([
    Payment.find()
      .populate('customerId', 'name')
      .populate('plotId', 'plotNumber')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit),
    Income.find()
      .populate('categoryId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit),
    Expense.find({ deleted: false })
      .populate('categoryId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit),
  ]);
  return { payments, income, expenses };
}

export async function getDashboardSummary({ dateFrom, dateTo } = {}) {
  const range = parseDateRange(dateFrom, dateTo);

  const paymentMatch = range ? { date: range } : {};
  const incomeMatch = range ? { date: range } : {};
  const expenseMatch = range ? { deleted: false, date: range } : { deleted: false };

  const [customers, plots, totalReceived, receivables, totalOtherIncome, totalExpenses] =
    await Promise.all([
      getCustomerCount(),
      getPlotStatusCounts(),
      sumDecimal(Payment, paymentMatch),
      getReceivables(),
      sumDecimal(Income, incomeMatch),
      sumDecimal(Expense, expenseMatch),
    ]);

  const operatingResult = totalOtherIncome.minus(totalExpenses);

  return {
    customers: { total: customers },
    plots,
    payments: { totalReceived: totalReceived.toString() },
    receivables,
    income: { totalOtherIncome: totalOtherIncome.toString() },
    expenses: { totalExpenses: totalExpenses.toString() },
    operatingResult: { amount: operatingResult.toString() },
    dateRange: range ? { dateFrom, dateTo } : null,
  };
}

export async function getDashboardTrends(opts) {
  return getTrends(opts);
}

export async function getDashboardRecentActivity(limit) {
  return getRecentActivity(limit);
}
