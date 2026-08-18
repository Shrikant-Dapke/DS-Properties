import Button from './Button.jsx';

export default function EmptyState({ title, description, actionLabel, onAction, children }) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-navy/15 bg-white px-6 py-10 text-center">
      <p className="font-display text-lg text-navy">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md font-sans text-sm text-navy/60">{description}</p>
      )}
      <div className="mt-4 flex justify-center">
        {children}
        {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
      </div>
    </div>
  );
}
