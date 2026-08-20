import {
  dailyTransactions,
  monthlyTransactions,
  periodSummary,
  balanceUpTo,
  categoryReport,
  customerReport,
  listPartnerLedger,
  partnerInflowTotals,
} from '../models/transactionModel.js';
import { getOpeningBalance } from '../models/settingsModel.js';
import { findPartnerByPublicId } from '../models/partnerModel.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

function serializeTx(tx) {
  return {
    publicId: tx.public_id,
    transactionType: tx.transaction_type,
    sourceType: tx.source_type,
    amount: tx.amount,
    paymentMode: tx.payment_mode,
    transactionDate: tx.transaction_date,
    referenceNumber: tx.reference_number,
    plotNumber: tx.plot_number,
    paidTo: tx.paid_to,
    description: tx.description,
    customer: tx.customer_public_id ? { publicId: tx.customer_public_id, name: tx.customer_name } : null,
    partner: tx.partner_public_id ? { publicId: tx.partner_public_id, name: tx.partner_name } : null,
    category: tx.category_public_id ? { publicId: tx.category_public_id, name: tx.category_name } : null,
    isReversal: tx.is_reversal,
    reversedAt: tx.reversed_at,
  };
}

function validDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

export async function getDailyReport({ date }) {
  const day = validDate(date);
  if (!day) throw new ValidationError('Invalid date');

  const [transactions, summary, upTo, openingBalance] = await Promise.all([
    dailyTransactions(day),
    periodSummary({ from: day, to: day }),
    balanceUpTo(day),
    getOpeningBalance(),
  ]);

  return {
    date: day,
    summary: {
      intake: summary.total_intake,
      outtake: summary.total_outtake,
      customerIntake: summary.customer_intake,
      partnerCapital: summary.partner_capital,
      partnerLoan: summary.partner_loan,
      net: Number(summary.total_intake) - Number(summary.total_outtake),
    },
    balance: {
      openingBalance,
      balanceAtEndOfDay: Number(openingBalance) + Number(upTo.total_intake) - Number(upTo.total_outtake),
    },
    transactions: transactions.map(serializeTx),
  };
}

export async function getMonthlyReport({ year, month, from, to }) {
  let y = null;
  let m = null;
  let rangeFrom;
  let rangeTo;

  if (from && to) {
    // Explicit inclusive period (weekly / yearly / custom).
    if (!validDate(from) || !validDate(to)) throw new ValidationError('Invalid date range');
    if (from > to) throw new ValidationError('From date must not be after To date');
    rangeFrom = from;
    rangeTo = to;
  } else {
    y = Number.parseInt(year, 10);
    m = Number.parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      throw new ValidationError('Invalid year or month');
    }
    rangeFrom = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getDate();
    rangeTo = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  const [summary, transactions, categories, customers, openingBalance] = await Promise.all([
    periodSummary({ from: rangeFrom, to: rangeTo }),
    monthlyTransactions({ from: rangeFrom, to: rangeTo, page: 1, limit: 1000, offset: 0 }),
    categoryReport({ from: rangeFrom, to: rangeTo }),
    customerReport({ from: rangeFrom, to: rangeTo }),
    getOpeningBalance(),
  ]);

  return {
    year: y,
    month: m,
    from: rangeFrom,
    to: rangeTo,
    summary: {
      intake: summary.total_intake,
      outtake: summary.total_outtake,
      customerIntake: summary.customer_intake,
      partnerCapital: summary.partner_capital,
      partnerLoan: summary.partner_loan,
      net: Number(summary.total_intake) - Number(summary.total_outtake),
      intakeCount: summary.intake_count,
      outtakeCount: summary.outtake_count,
    },
    openingBalance,
    categories,
    topCustomers: customers,
    transactions: transactions.rows.map(serializeTx),
  };
}

export async function getCategoryReport({ from, to }) {
  if (!validDate(from) || !validDate(to)) throw new ValidationError('Invalid date range');
  const rows = await categoryReport({ from, to });
  const total = rows.reduce((acc, r) => acc + Number(r.total_outtake), 0);
  return { from, to, totalOuttake: total, categories: rows };
}

export async function getPartnerFinancialReport(publicId, { from, to, page, limit, offset }) {
  const partner = await findPartnerByPublicId(publicId);
  if (!partner) throw new NotFoundError('Partner not found');
  if (from && to) {
    if (!validDate(from) || !validDate(to)) throw new ValidationError('Invalid date range');
    if (from > to) throw new ValidationError('From date must not be after To date');
  }

  const range = from && to ? { from, to } : {};
  const [totals, ledger] = await Promise.all([
    partnerInflowTotals(partner.id, range),
    listPartnerLedger(partner.id, { ...range, page, limit, offset }),
  ]);

  return {
    publicId,
    from: range.from ?? null,
    to: range.to ?? null,
    totals: {
      capitalContributions: totals.capital_contributions,
      loanReceipts: totals.loan_receipts,
      totalInflow: totals.total_inflow,
    },
    ledger: {
      total: ledger.total,
      rows: ledger.rows.map(serializeTx),
    },
  };
}