import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeFilter } from './DateRangeFilter.jsx';
import { DATE_MODES } from '../../utils/dateRange.js';

function setup(overrides = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<DateRangeFilter onChange={onChange} {...overrides} />);
  return { onChange, user };
}

function summaryText() {
  return screen.getByTestId('date-range-summary').textContent;
}

describe('DateRangeFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to the current financial year without a spurious emission', () => {
    const { onChange } = setup({ defaultMode: DATE_MODES.YEARLY });
    expect(summaryText()).toBe('2026-04-01 – 2027-03-31');
    // The initial value is a no-op: the page's own load fetches the default.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits on mode changes with the correct computed range', () => {
    const { onChange } = setup({ defaultMode: DATE_MODES.MONTHLY });
    expect(summaryText()).toBe('2026-08-01 – 2026-08-31');

    fireEvent.change(screen.getByLabelText(/period/i), { target: { value: DATE_MODES.WEEKLY } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      mode: 'weekly',
      from: '2026-08-17',
      to: '2026-08-23',
    });
  });

  it('emits a single-day range in daily mode and follows the reference date', () => {
    const { onChange } = setup({ defaultMode: DATE_MODES.DAILY });
    expect(summaryText()).toBe('2026-08-20 – 2026-08-20');

    fireEvent.change(screen.getByLabelText(/reference date/i), { target: { value: '2026-08-05' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ mode: 'daily', from: '2026-08-05', to: '2026-08-05' });
  });

  it('with allowEmpty, starts empty (all dates) and emits once a custom range is set', () => {
    const { onChange } = setup({ defaultMode: DATE_MODES.CUSTOM, allowEmpty: true });
    expect(summaryText()).toBe('All dates');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText(/to/i), { target: { value: '2026-08-15' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ mode: 'custom', from: '2026-08-01', to: '2026-08-15' });
  });

  it('never emits a half-filled custom range (only one side set)', () => {
    const { onChange } = setup({ defaultMode: DATE_MODES.CUSTOM, allowEmpty: true });

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-08-01' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('date-range-error')).toHaveTextContent('Select both From and To dates');

    fireEvent.change(screen.getByLabelText(/to/i), { target: { value: '2026-08-15' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('date-range-error')).not.toBeInTheDocument();
  });

  it('rejects a reversed custom range with an inline error and no emission', () => {
    const { onChange } = setup({ defaultMode: DATE_MODES.CUSTOM });

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-08-20' } });
    fireEvent.change(screen.getByLabelText(/to/i), { target: { value: '2026-08-01' } });

    expect(screen.getByTestId('date-range-error')).toHaveTextContent('From date must not be after To date');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('recovers and emits once the custom range becomes valid again', () => {
    const { onChange } = setup({ defaultMode: DATE_MODES.CUSTOM });

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-08-20' } });
    fireEvent.change(screen.getByLabelText(/to/i), { target: { value: '2026-08-01' } });
    expect(screen.getByTestId('date-range-error')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/to/i), { target: { value: '2026-08-30' } });
    expect(screen.queryByTestId('date-range-error')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ mode: 'custom', from: '2026-08-20', to: '2026-08-30' });
  });
});