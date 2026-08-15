import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as incomeService from '../services/income.service.js';
import Spinner from '../components/Spinner.jsx';
import { formatCurrency } from '../utils/format.js';

export default function IncomeDetailPage() {
  const { id } = useParams();
  const [income, setIncome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    incomeService
      .getIncome(id)
      .then(setIncome)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load income.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner size="sm" className="mt-6" />;
  if (error)
    return <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>;
  if (!income) return null;

  const rows = [
    ['Category', income.categoryId ? income.categoryId.name : '—'],
    ['Amount', formatCurrency(income.amount)],
    ['Date', income.date ? new Date(income.date).toLocaleDateString() : '—'],
    ['Description', income.description || '—'],
    ['Reference', income.reference || '—'],
    ['Notes', income.notes || '—'],
    ['Created', income.createdAt ? new Date(income.createdAt).toLocaleString() : '—'],
    ['Updated', income.updatedAt ? new Date(income.updatedAt).toLocaleString() : '—'],
  ];

  return (
    <section className="max-w-xl">
      <Link to="/income" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Other Income
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Income</h1>

      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4 border-b border-navy/5 pb-3">
              <dt className="w-32 font-mono text-xs uppercase tracking-wider text-navy/50">{label}</dt>
              <dd className={`font-sans ${label === 'Amount' ? 'font-mono text-mint' : 'text-navy'}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 flex gap-3">
        <Link
          to={`/income/${income._id}/edit`}
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
        >
          Edit
        </Link>
      </div>
    </section>
  );
}
