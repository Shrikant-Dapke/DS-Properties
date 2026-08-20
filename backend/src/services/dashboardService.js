import {
  balanceBreakdown,
  periodSummary,
  recentTransactions,
  categoryReport,
} from '../models/transactionModel.js';
import { getOpeningBalance } from '../models/settingsModel.js';
import { cacheGet, cacheSet, invalidateFinancialCache } from '../utils/cache.js';
import { FINANCIAL_YEAR_START_MONTH } from '../config/constants.js';

function financialYearRange(date = new Date()) {
  const startYear = date.getMonth() + 1 >= FINANCIAL_YEAR_START_MONTH
    ? date.getFullYear()
    : date.getFullYear() - 1;
  const start = new Date(Date.UTC(startYear, FINANCIAL_YEAR_START_MONTH - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, FINANCIAL_YEAR_START_MONTH - 1, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), startYear };
}

export async function getDashboardSummary() {
  const cacheKey = 'financial:dashboard';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const [breakdown, openingBalance, recent, fy] = await Promise.all([
    balanceBreakdown(),
    getOpeningBalance(),
    recentTransactions(8),
    financialYearRange(),
  ]);

  const fySummary = await periodSummary({ from: fy.from, to: fy.to });

  const result = {
    openingBalance,
    balance: Number(openingBalance) + Number(breakdown.total_intake) - Number(breakdown.total_outtake),
    totals: {
      totalIntake: breakdown.total_intake,
      totalOuttake: breakdown.total_outtake,
      customerIntake: breakdown.customer_intake,
      partnerCapital: breakdown.partner_capital,
      partnerLoan: breakdown.partner_loan,
    },
    financialYear: {
      startYear: fy.startYear,
      from: fy.from,
      to: fy.to,
      intake: fySummary.total_intake,
      outtake: fySummary.total_outtake,
      net: Number(fySummary.total_intake) - Number(fySummary.total_outtake),
    },
    recentTransactions: recent,
  };

  cacheSet(cacheKey, result, 30);
  return result;
}

export async function getCategoryBreakdown() {
  const cacheKey = 'financial:categoryBreakdown';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const fy = financialYearRange();
  const rows = await categoryReport({ from: fy.from, to: fy.to });
  cacheSet(cacheKey, rows, 60);
  return rows;
}

export function invalidateFinancialCachePublic() {
  invalidateFinancialCache();
}