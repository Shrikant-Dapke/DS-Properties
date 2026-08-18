import { useEffect, useState } from 'react';
import { listTransactions, getFinanceSummary, SOURCE_LABELS } from '../services/finance.service.js';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency, formatDate } from '../utils/format.js';

const inputClass =
  'w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy outline-none transition-colors focus:border-indigo focus:ring-1 focus:ring-indigo';

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'payment', label: 'Payment' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'capital', label: 'Partner Capital' },
  { value: 'loan', label: 'Loan' },
];

function SummaryPill({ label, value, tone = 'navy' }) {
  const color = tone === 'in' ? 'text-mint' : tone === 'out' ? 'text-orange' : 'text-navy';
  return (
    <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-wider text-navy/50">{label}</p>
      <p className={`font-mono text-lg ${color}`}>{value}</p>
    </div>
  );
}

function linkedLabel(tx) {
  if (tx.sourceType === 'payment') {
    const parts = [tx.customerId?.name, tx.plotId?.plotNumber].filter(Boolean);
    return parts.length ? parts.join(' · ') : '—';
  }
  if (tx.sourceType === 'income' || tx.sourceType === 'expense') {
    return tx.categoryId?.name || '—';
  }
  if (tx.sourceType === 'capital') return tx.partnerId?.name || '—';
  if (tx.sourceType === 'loan') return tx.description || '—';
  return '—';
}

export default function FinancePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [totals, setTotals] = useState({ in: '0', out: '0', net: '0' });
  const [summary, setSummary] = useState(null);
  const [source, setSource] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getFinanceSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next    react-hooks/exhaustive-deps
  }, [tab, source, dateFrom, dateTo, page]);

  async function load() {
    setLoading(true);
    setError('');
    const params = { page, limit: 25 };
    if (tab === 'in') params.direction = 'in';
    if (tab === 'out') params.direction = 'out';
    if (source !== 'all') params.sourceType = source;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    try {
      const data = await listTransactions(params);
      setItems(data.items);
      setPagination(data.pagination);
      setTotals(data.totals);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load finance transactions.'));
    } finally {
      setLoading(false);
    }
  }

  function switchTab(value) {
    setTab(value);
    setPage(1);
  }

  const activeCount =
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (source !== 'all' ? 1 : 0);

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy">Finance</h1>
          <p className="font-sans text-sm text-navy/60">
            Unified ledger of all money in and out across the business.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Finance view">
        {[
          { value: 'all', label: 'All Transactions' },
          { value: 'in', label: 'Money In' },
          { value: 'out', label: 'Money Out' },
        ].map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => switchTab(t.value)}
            aria-pressed={tab === t.value}
            className={`rounded-full px-3 py-1.5 font-sans text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 ${
              tab === t.value ? 'bg-indigo text-white shadow-sm' : 'bg-white text-navy hover:bg-indigo/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <FilterPanel activeCount={activeCount} onClear={() => { setSource('all'); setDateFrom(''); setDateTo(''); setPage(1); }}>
          <div className="min-w-[170px]">
            <label htmlFor="fin-source" className="sr-only">
              Filter by source
            </label>
            <select id="fin-source" className={inputClass} value={source} onChange={(e) => { setPage(1); setSource(e.target.value); }}>
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label htmlFor="fin-from" className="sr-only">From date</label>
            <input id="fin-from" type="date" className={inputClass} value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} />
          </div>
          <div className="min-w-[150px]">
            <label htmlFor="fin-to" className="sr-only">To date</label>
            <input id="fin-to" type="date" className={inputClass} value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} />
          </div>
        </FilterPanel>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <SummaryPill label="Total In" value={formatCurrency(totals.in)} tone="in" />
        <SummaryPill label="Total Out" value={formatCurrency(totals.out)} tone="out" />
        <SummaryPill label="Net" value={formatCurrency(totals.net)} tone="navy" />
        {summary && (
          <SummaryPill label="Ledger Records" value={String(summary.count)} tone="navy" />
        )}
      </div>

      {loading ? (
        <p className="mt-4 font-sans text-sm text-navy/60">Loading…</p>
      ) : error ? (
        <ErrorState title="Unable to load finance." message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No transactions found"
          description="Records will appear here once payments, income, expenses, partner capital, or loans are added."
        />
      ) : (
        <div className="mt-4 table-wrap rounded-lg bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Linked</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <tr key={tx._id} className="border-b border-navy/5">
                  <td className="px-4 py-3 font-mono text-sm text-navy">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3 font-sans text-navy">{SOURCE_LABELS[tx.sourceType] || tx.sourceType}</td>
                  <td className="px-4 py-3 font-sans text-navy/80">{linkedLabel(tx)}</td>
                  <td className="px-4 py-3 font-sans text-navy/70">{tx.method || '—'}</td>
                  <td className={`num px-4 py-3 text-right font-mono text-sm ${tx.direction === 'in' ? 'text-mint' : 'text-orange'}`}>
                    {tx.direction === 'in' ? '+' : '−'}
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 font-sans text-sm text-navy/60">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-navy/15 px-3 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2">
            Prev
          </button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-navy/15 px-3 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2">
            Next
          </button>
        </div>
      )}
    </section>
  );
}
