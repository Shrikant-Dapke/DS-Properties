import Spinner from './Spinner.jsx';

const base =
  'inline-flex items-center justify-center gap-2 rounded px-4 py-2 font-sans font-medium transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100';

const variants = {
  primary: 'bg-indigo text-white hover:bg-indigo/90',
  secondary: 'border border-indigo text-indigo hover:bg-indigo/10',
  success: 'bg-mint text-navy hover:bg-mint/90',
  danger: 'bg-orange text-white hover:bg-orange/90',
  ghost: 'border border-navy/20 text-navy hover:bg-navy/5',
};

export default function Button({
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
