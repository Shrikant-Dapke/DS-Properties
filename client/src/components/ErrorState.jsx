import Button from './Button.jsx';

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
}) {
  return (
    <div className="mt-6 rounded-lg border border-orange/30 bg-orange/5 px-6 py-8 text-center">
      <p className="font-display text-lg text-navy">{title}</p>
      {message && (
        <p className="mx-auto mt-1 max-w-md font-sans text-sm text-navy/60">{message}</p>
      )}
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
