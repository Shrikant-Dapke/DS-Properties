export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
  buttonClassName,
}) {
  if (!totalPages || totalPages <= 1) return null;

  const wrapper = `mt-4 flex items-center gap-3 font-sans text-sm text-navy/60 ${className || ''}`;
  const btn =
    buttonClassName ||
    'rounded border border-navy/15 px-3 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2';

  return (
    <div className={wrapper}>
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={btn}>
        Prev
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={btn}
      >
        Next
      </button>
    </div>
  );
}
