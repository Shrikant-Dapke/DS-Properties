import { describe, it, expect } from 'vitest';
import { formatDate } from './formatters.js';

describe('formatDate', () => {
  it('formats date-only values without a UTC day-shift', () => {
    expect(formatDate('2026-09-13')).toMatch(/13.*2026/);
  });

  it('formats full ISO datetimes instead of leaking raw timestamps', () => {
    const out = formatDate('2026-09-13T10:05:56.425Z');
    expect(out).not.toContain('T');
    expect(out).toMatch(/2026/);
  });

  it('returns an em-dash for empty values and raw text for garbage', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
