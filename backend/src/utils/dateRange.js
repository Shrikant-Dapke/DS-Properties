import { ValidationError } from './errors.js';
import { FINANCIAL_YEAR_START_MONTH } from '../config/constants.js';

// Shared date-range semantics for the whole API. Transactions carry a plain
// DATE (no time component), so ranges are inclusive: from <= date <= to.
// The project's financial year starts in April (FINANCIAL_YEAR_START_MONTH).

export function financialYearRange(date = new Date()) {
  const startYear = date.getMonth() + 1 >= FINANCIAL_YEAR_START_MONTH
    ? date.getFullYear()
    : date.getFullYear() - 1;
  const start = new Date(Date.UTC(startYear, FINANCIAL_YEAR_START_MONTH - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, FINANCIAL_YEAR_START_MONTH - 1, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), startYear };
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function assertValidRange(from, to) {
  if (from && !to) {
    throw new ValidationError('Both from and to dates are required for a date range');
  }
  if (!from && to) {
    throw new ValidationError('Both from and to dates are required for a date range');
  }
  if (from && to && from > to) {
    throw new ValidationError('From date must not be after To date');
  }
}