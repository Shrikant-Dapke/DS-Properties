const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

function toNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function formatCurrency(value) {
  if (isEmpty(value)) return '—';
  const n = toNumber(value);
  if (n === null) return '—';
  return currencyFormatter.format(n);
}

export function formatNumber(value) {
  if (isEmpty(value)) return '—';
  const n = toNumber(value);
  if (n === null) return '—';
  return numberFormatter.format(n);
}

export function formatDate(value) {
  if (isEmpty(value)) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN');
}

export function formatDateTime(value) {
  if (isEmpty(value)) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN');
}
