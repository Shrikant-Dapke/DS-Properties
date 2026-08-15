const variants = {
  navy: 'bg-navy/5 text-navy',
  indigo: 'bg-indigo/10 text-indigo',
  orange: 'bg-orange/15 text-orange',
  mint: 'bg-mint/15 text-mint',
  lavender: 'bg-lavender/15 text-lavender',
};

export default function Badge({ color = 'navy', className = '', children }) {
  return (
    <span
      className={`inline-block rounded px-2 py-1 font-sans text-xs ${
        variants[color] || variants.navy
      } ${className}`}
    >
      {children}
    </span>
  );
}
