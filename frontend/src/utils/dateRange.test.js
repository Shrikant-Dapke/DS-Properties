import { describe, it, expect } from 'vitest';
import {
  toISODate,
  addDays,
  financialYearRange,
  isoWeekRange,
  monthRange,
  rangeForMode,
  isValidRange,
  formatRangeLabel,
  DATE_MODES,
} from './dateRange.js';

describe('dateRange utils', () => {
  describe('toISODate', () => {
    it('formats a Date as YYYY-MM-DD', () => {
      expect(toISODate(new Date('2026-08-20T14:30:00Z'))).toBe('2026-08-20');
    });
  });

  describe('addDays', () => {
    it('rolls over month boundaries', () => {
      expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    });

    it('rolls over year boundaries', () => {
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });

    it('supports negative offsets', () => {
      expect(addDays('2026-08-20', -1)).toBe('2026-08-19');
    });
  });

  describe('financialYearRange', () => {
    it('uses the April start for dates in the second half of the year', () => {
      expect(financialYearRange(new Date('2026-08-20'))).toEqual({
        from: '2026-04-01',
        to: '2027-03-31',
        startYear: 2026,
      });
    });

    it('assigns dates before April to the previous financial year', () => {
      expect(financialYearRange(new Date('2026-03-31'))).toEqual({
        from: '2025-04-01',
        to: '2026-03-31',
        startYear: 2025,
      });
    });

    it('treats April 1 as the start of the new financial year', () => {
      expect(financialYearRange(new Date('2026-04-01')).from).toBe('2026-04-01');
    });
  });

  describe('isoWeekRange', () => {
    it('starts the week on Monday', () => {
      // 2026-08-19 is a Wednesday
      expect(isoWeekRange(new Date('2026-08-19'))).toEqual({
        from: '2026-08-17',
        to: '2026-08-23',
      });
    });

    it('wraps a Sunday into the week that just ended', () => {
      expect(isoWeekRange(new Date('2026-08-16'))).toEqual({
        from: '2026-08-10',
        to: '2026-08-16',
      });
    });
  });

  describe('monthRange', () => {
    it('covers a short month fully', () => {
      expect(monthRange(new Date('2026-02-10'))).toEqual({
        from: '2026-02-01',
        to: '2026-02-28',
      });
    });

    it('covers a long month fully', () => {
      expect(monthRange(new Date('2026-12-05'))).toEqual({
        from: '2026-12-01',
        to: '2026-12-31',
      });
    });
  });

  describe('rangeForMode', () => {
    const ref = new Date('2026-08-20');

    it('daily collapses to a single date', () => {
      expect(rangeForMode(DATE_MODES.DAILY, ref)).toEqual({
        mode: 'daily',
        from: '2026-08-20',
        to: '2026-08-20',
      });
    });

    it('weekly is Monday-start', () => {
      expect(rangeForMode(DATE_MODES.WEEKLY, ref).from).toBe('2026-08-17');
      expect(rangeForMode(DATE_MODES.WEEKLY, ref).to).toBe('2026-08-23');
    });

    it('monthly covers the reference month', () => {
      expect(rangeForMode(DATE_MODES.MONTHLY, ref)).toEqual({
        mode: 'monthly',
        from: '2026-08-01',
        to: '2026-08-31',
      });
    });

    it('yearly is the current financial year', () => {
      expect(rangeForMode(DATE_MODES.YEARLY, ref)).toEqual({
        mode: 'yearly',
        from: '2026-04-01',
        to: '2027-03-31',
        startYear: 2026,
      });
    });

    it('custom starts empty', () => {
      expect(rangeForMode(DATE_MODES.CUSTOM, ref)).toEqual({
        mode: 'custom',
        from: '',
        to: '',
      });
    });
  });

  describe('isValidRange', () => {
    it('accepts an inclusive ordered pair', () => {
      expect(isValidRange('2026-08-01', '2026-08-31')).toBe(true);
    });

    it('rejects reversed dates', () => {
      expect(isValidRange('2026-08-31', '2026-08-01')).toBe(false);
    });

    it('rejects missing or malformed dates', () => {
      expect(isValidRange('', '')).toBe(false);
      expect(isValidRange('2026-08-01', '')).toBe(false);
      expect(isValidRange('08/01/2026', '2026-08-31')).toBe(false);
    });
  });

  describe('formatRangeLabel', () => {
    it('joins a range with an en dash', () => {
      expect(formatRangeLabel('2026-08-01', '2026-08-31')).toBe('2026-08-01 – 2026-08-31');
    });

    it('collapses a single-day range', () => {
      expect(formatRangeLabel('2026-08-01', '2026-08-01')).toBe('2026-08-01');
    });

    it('labels an empty range as all time', () => {
      expect(formatRangeLabel('', '')).toBe('All time');
    });
  });
});