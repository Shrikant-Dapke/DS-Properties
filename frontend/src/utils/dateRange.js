import { FINANCIAL_YEAR_START_MONTH } from './constants.js';

export const DATE_MODES = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom',
});

export const MODE_LABELS = Object.freeze({
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
});

// Matches backend semantics: transactions carry a plain DATE and ranges are
// inclusive of both boundary dates.

export function toISODate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Financial year starts in April: 2026-08-20 -> { from: 2026-04-01, to: 2027-03-31 }.
export function financialYearRange(date = new Date()) {
  const startYear =
    date.getMonth() + 1 >= FINANCIAL_YEAR_START_MONTH
      ? date.getFullYear()
      : date.getFullYear() - 1;
  return {
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
    startYear,
  };
}

// Week starts Monday, ISO-8601 style.
export function isoWeekRange(date = new Date()) {
  const day = (date.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const monday = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() - day));
  return {
    from: monday.toISOString().slice(0, 10),
    to: addDays(monday.toISOString().slice(0, 10), 6),
  };
}

export function monthRange(date = new Date()) {
  const from = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0)).getDate();
  return {
    from,
    to: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

// Returns { mode, from, to } for the given mode at the given reference date.
export function rangeForMode(mode, referenceDate = new Date()) {
  switch (mode) {
    case DATE_MODES.DAILY:
      return { mode, from: toISODate(referenceDate), to: toISODate(referenceDate) };
    case DATE_MODES.WEEKLY:
      return { mode, ...isoWeekRange(referenceDate) };
    case DATE_MODES.MONTHLY:
      return { mode, ...monthRange(referenceDate) };
    case DATE_MODES.YEARLY:
      return { mode, ...financialYearRange(referenceDate) };
    default:
      return { mode: DATE_MODES.CUSTOM, from: '', to: '' };
  }
}

export function isValidRange(from, to) {
  if (!from || !to) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
}

// Convenience: "12 Apr 2026 – 30 Apr 2026" for export subtitles and headers.
export function formatRangeLabel(from, to) {
  if (!from && !to) return 'All time';
  if (from === to) return from;
  return `${from} – ${to}`;
}