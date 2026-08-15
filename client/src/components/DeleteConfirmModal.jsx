import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`);
  const restoreFocus = useRef(null);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement;

    const panel = panelRef.current;
    const moveFocus = () => {
      const first = panel?.querySelector(FOCUSABLE);
      (first || panel)?.focus();
    };
    const t = setTimeout(moveFocus, 20);

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
          (el) => !el.disabled && el.offsetParent !== null
        );
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (restoreFocus.current && typeof restoreFocus.current.focus === 'function') {
        restoreFocus.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-navy/50 px-4 backdrop-blur-sm print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        className="modal-panel w-full max-w-sm rounded-lg bg-chalk p-6 shadow-xl"
      >
        <h2 id={titleId.current} className="font-display text-xl text-navy">
          {title}
        </h2>
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
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-navy/20 px-4 py-2 font-sans text-navy transition-colors duration-150 hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded bg-orange px-4 py-2 font-sans font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-orange/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
