const STYLES = {
  success: 'border-mint/40 bg-mint/15 text-mint',
  error: 'border-orange bg-orange text-white',
  warning: 'border-orange/40 bg-orange/15 text-orange',
  info: 'border-indigo/40 bg-indigo/10 text-indigo',
};

const ICONS = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i',
};

export default function Toast({ toasts, onClose }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-md ${
            STYLES[t.type] || STYLES.info
          }`}
        >
          <span aria-hidden="true" className="mt-0.5 font-mono text-sm leading-none">
            {ICONS[t.type] || 'i'}
          </span>
          <span className="flex-1 font-sans text-sm">{t.message}</span>
          <button
            type="button"
            onClick={() => onClose(t.id)}
            aria-label="Dismiss notification"
            className="font-sans text-lg leading-none opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
