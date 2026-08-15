import { useState } from 'react';

function Chevron({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function FilterPanel({ activeCount = 0, onClear, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg bg-white p-1 shadow-sm print:hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 font-sans text-sm font-medium text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
        >
          <Chevron open={open} />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-indigo px-1.5 py-0.5 font-mono text-xs font-medium text-white">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="font-sans text-xs text-navy/50 underline-offset-2 hover:text-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
          >
            Clear
          </button>
        )}
      </div>
      <div
        className={`flex flex-wrap items-end gap-3 p-3 ${open ? 'block' : 'hidden'} lg:flex`}
      >
        {children}
      </div>
    </div>
  );
}
