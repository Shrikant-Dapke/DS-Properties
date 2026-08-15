import { cloneElement, isValidElement } from 'react';

export const inputClass =
  'mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy outline-none focus:border-indigo focus:ring-1 focus:ring-indigo';

export default function Field({ label, htmlFor, required = false, error, hint, className = '', children }) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  let control = children;
  if (error && isValidElement(children) && htmlFor) {
    control = cloneElement(children, {
      'aria-invalid': true,
      'aria-describedby': errorId,
    });
  }

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block font-mono text-xs uppercase tracking-wider text-navy/50"
        >
          {label}
          {required && <span className="text-orange"> *</span>}
        </label>
      )}
      {control}
      {hint && <p className="mt-1 font-sans text-xs text-navy/50">{hint}</p>}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-orange">
          {error}
        </p>
      )}
    </div>
  );
}
