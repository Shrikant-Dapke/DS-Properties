import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DATE_MODES,
  MODE_LABELS,
  rangeForMode,
} from '../../utils/dateRange.js';
import { DATE_TODAY } from '../../utils/constants.js';
import { Select } from './Select.jsx';
import { Button } from './Button.jsx';

const MODE_ORDER = [DATE_MODES.DAILY, DATE_MODES.WEEKLY, DATE_MODES.MONTHLY, DATE_MODES.YEARLY, DATE_MODES.CUSTOM];

// Self-contained date-range control. Emits only valid { mode, from, to }
// objects via onChange; while the custom range is invalid the component shows
// an inline error and does not emit. allowEmpty keeps the custom range
// optional (meaning "all dates") for pages that default to all-time.
export function DateRangeFilter({
  defaultMode = DATE_MODES.YEARLY,
  initialValue = null,
  allowEmpty = false,
  onChange,
  className = '',
}) {
  const today = DATE_TODAY();
  const [mode, setMode] = useState(defaultMode);
  const [customFrom, setCustomFrom] = useState(initialValue?.mode === DATE_MODES.CUSTOM ? initialValue.from || '' : '');
  const [customTo, setCustomTo] = useState(initialValue?.mode === DATE_MODES.CUSTOM ? initialValue.to || '' : '');
  const [reference, setReference] = useState(today);
  const [touched, setTouched] = useState(false);

  const initialComputed = useMemo(() => {
    if (defaultMode === DATE_MODES.CUSTOM) {
      return { mode: defaultMode, from: initialValue?.from || '', to: initialValue?.to || '' };
    }
    return { mode: defaultMode, ...rangeForMode(defaultMode) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computed = useMemo(() => {
    if (mode === DATE_MODES.CUSTOM) {
      return { mode, from: customFrom, to: customTo };
    }
    return { mode, ...rangeForMode(mode, new Date(`${reference}T00:00:00Z`)) };
  }, [mode, customFrom, customTo, reference]);

  // A half-filled custom range (only one side set) is never queryable, and a
  // reversed one would be rejected by the API. With allowEmpty, a fully empty
  // custom range is valid ("all dates").
  const bothFilled = Boolean(customFrom) && Boolean(customTo);
  const partial = Boolean(customFrom) !== Boolean(customTo);
  const reversed = bothFilled && customFrom > customTo;
  const invalid = mode === DATE_MODES.CUSTOM && (partial || reversed || (!allowEmpty && !bothFilled));

  // Emits only on actual changes (mount emission is a no-op) and only when
  // the current selection is valid.
  const lastEmitted = useRef(JSON.stringify(initialComputed));
  useEffect(() => {
    const payload = JSON.stringify(computed) + (invalid ? ':invalid' : '');
    if (payload === lastEmitted.current) return;
    lastEmitted.current = payload;
    if (!invalid) onChange(computed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, invalid]);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setTouched(true);
  };

  const resetToCustom = () => {
    setMode(DATE_MODES.CUSTOM);
    setTouched(true);
  };

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`} data-testid="date-range-filter">
      <Select
        label="Period"
        id="date-range-mode"
        value={mode}
        onChange={(e) => handleModeChange(e.target.value)}
        className="w-36"
      >
        {MODE_ORDER.map((m) => (
          <option key={m} value={m}>
            {MODE_LABELS[m]}
          </option>
        ))}
      </Select>

      {mode === DATE_MODES.CUSTOM ? (
        <>
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="date-range-from" className="mb-1 block text-sm font-medium text-slate-700">
                From
              </label>
              <input
                id="date-range-from"
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setTouched(true); }}
                className={`rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  invalid
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-400'
                }`}
              />
            </div>
            <div>
              <label htmlFor="date-range-to" className="mb-1 block text-sm font-medium text-slate-700">
                To
              </label>
              <input
                id="date-range-to"
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setTouched(true); }}
                className={`rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  invalid
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-400'
                }`}
              />
            </div>
          </div>
          {allowEmpty && !bothFilled && !partial && (
            <button
              type="button"
              onClick={resetToCustom}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          )}
          {invalid && (
            <p className="text-xs text-red-600" data-testid="date-range-error">
              {reversed ? 'From date must not be after To date' : 'Select both From and To dates'}
            </p>
          )}
        </>
      ) : (
        <div className="flex items-end gap-2">
          <input
            type="date"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-emerald-500 focus:ring-emerald-400"
            aria-label="Reference date"
          />
          {touched && (
            <Button variant="ghost" size="sm" onClick={() => { setReference(today); }}>
              Today
            </Button>
          )}
        </div>
      )}

      <span className="text-sm text-slate-500" data-testid="date-range-summary">
        {computed.from && computed.to ? `${computed.from} – ${computed.to}` : 'All dates'}
      </span>
    </div>
  );
}