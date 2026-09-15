export function Input({ label, error, hint, className = '', inputClassName = '', id, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`min-h-[48px] w-full rounded-lg border px-3 py-3 text-base focus:outline-none focus:ring-2 md:min-h-0 md:py-2 md:text-sm ${inputClassName} ${
          error
            ? 'border-red-300 focus:ring-red-400'
            : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-400'
        }`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}