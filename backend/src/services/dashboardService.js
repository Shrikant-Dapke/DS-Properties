import {
  balanceBreakdown,
  periodSummary,
  recentTransactions,
  categoryReport,
  balanceUpTo,
} from '../models/transactionModel.js';
import { getOpeningBalance } from '../models/settingsModel.js';
import { cacheGet, cacheSet, invalidateFinancialCache } from '../utils/cache.js';
import { financialYearRange, addDays, assertValidRange } from '../utils/dateRange.js';

// Cache keys are scoped to the requested period so different ranges can never
// share aggregate results.
function cacheKeyFor(prefix, from, to) {
  return `financial:${prefix}:${from}:${to}`;
}

// The default period is the current financial year (April start) — this keeps
// the out-of-the-box dashboard behavior identical to before.
export async function getDashboardSummary({ from = null, to = null } = {}) {
  assertValidRange(from, to);
  const period = from && to ? { from, to } : financialYearRange();
  const cacheKey = cacheKeyFor('dashboard', period.from, period.to);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const [breakdown, openingBalance, recent, priorBalance, periodData] = await Promise.all([
    balanceBreakdown(),
    getOpeningBalance(),
    recentTransactions(8, period),
    balanceUpTo(addDays(period.from, -1)),
    periodSummary(period),
  ]);

  const periodOpeningBalance =
    Number(openingBalance) + Number(priorBalance.total_intake) - Number(priorBalance.total_outtake);

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
    financialYear: financialYearRange(),
    period: {
      from: period.from,
      to: period.to,
      openingBalance: periodOpeningBalance,
      intake: periodData.total_intake,
      outtake: periodData.total_outtake,
      net: Number(periodData.total_intake) - Number(periodData.total_outtake),
      customerIntake: periodData.customer_intake,
      partnerCapital: periodData.partner_capital,
      partnerLoan: periodData.partner_loan,
      intakeCount: periodData.intake_count,
      outtakeCount: periodData.outtake_count,
    },
    recentTransactions: recent,
  };

  cacheSet(cacheKey, result, 30);
  return result;
}

export async function getCategoryBreakdown({ from = null, to = null } = {}) {
  assertValidRange(from, to);
  const period = from && to ? { from, to } : financialYearRange();
  const cacheKey = cacheKeyFor('categoryBreakdown', period.from, period.to);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const rows = await categoryReport(period);
  cacheSet(cacheKey, rows, 60);
  return rows;
}

export function invalidateFinancialCachePublic() {
  invalidateFinancialCache();
}