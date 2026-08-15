export default function DeleteConfirmModal({
  open,
  name,
  title = 'Delete?',
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  busy = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-chalk p-6 shadow-lg">
        <h2 className="font-display text-xl text-navy">{title}</h2>
        <p className="mt-2 font-sans text-sm text-navy/70">
          {message || (
            <>
              This will permanently delete{' '}
              <span className="font-medium text-navy">{name}</span>. This action cannot be undone.
            </>
          )}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-navy/20 px-4 py-2 font-sans text-navy hover:bg-navy/5 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded bg-orange px-4 py-2 font-sans font-medium text-white hover:bg-orange/90 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
