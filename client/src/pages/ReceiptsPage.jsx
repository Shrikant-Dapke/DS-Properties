import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as capitalService from '../services/capital.service.js';
import * as loanService from '../services/loan.service.js';
import * as partnerService from '../services/partner.service.js';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency, formatDate } from '../utils/format.js';

const inputClass =
  'w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy outline-none transition-colors focus:border-indigo focus:ring-1 focus:ring-indigo';

const RECEIPT_TYPES = [
  { value: 'capital', label: 'Partner Capital' },
  { value: 'loan', label: 'Loan Received' },
];

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-wider text-navy/50">{label}</p>
      <p className="font-mono text-lg text-navy">{value}</p>
    </div>
  );
}

export default function ReceiptsPage() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'loan' ? 'loan' : 'capital';
  const [type, setType] = useState(initialType);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalAmount: '0', count: 0 });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [partners, setPartners] = useState([]);
  const [partner, setPartner] = useState('All');
  const [lender, setLender] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    partnerService.listPartners({ limit: 200 }).then((r) => setPartners(r.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, partner, lender, dateFrom, dateTo, page]);

  async function load() {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (type === 'capital' && partner !== 'All') params.partner = partner;
    if (type === 'loan' && lender.trim()) params.lender = lender.trim();
    try {
      const data =
        type === 'capital'
          ? await capitalService.listCapital(params)
          : await loanService.listLoans(params);
      setItems(data.items);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load receipts.'));
    } finally {
      setLoading(false);
    }
  }

  function switchType(value) {
    setType(value);
    setPartner('All');
    setLender('');
    setPage(1);
  }

  const activeCount =
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (type === 'capital' && partner !== 'All' ? 1 : 0) + (type === 'loan' && lender.trim() ? 1 : 0);

  function clearFilters() {
    setPartner('All');
    setLender('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Receipts</h1>
        <Link
          to={`/receipts/new?type=${type}`}
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white transition-colors duration-150 hover:bg-indigo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
        >
          Record Receipt
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Receipt type">
        {RECEIPT_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => switchType(t.value)}
            aria-pressed={type === t.value}
            className={`rounded-full px-3 py-1.5 font-sans text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 ${
              type === t.value ? 'bg-indigo text-white shadow-sm' : 'bg-white text-navy hover:bg-indigo/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <FilterPanel activeCount={activeCount} onClear={clearFilters}>
          {type === 'capital' && (
            <div className="min-w-[170px]">
              <label htmlFor="rcp-partner" className="sr-only">
                Filter by partner
              </label>
              <select
                id="rcp-partner"
                className={inputClass}
                value={partner}
                onChange={(e) => {
                  setPage(1);
                  setPartner(e.target.value);
                }}
              >
                <option value="All">All partners</option>
                {partners.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {type === 'loan' && (
            <div className="min-w-[170px] flex-1">
              <label htmlFor="rcp-lender" className="sr-only">
                Search lender
              </label>
              <input
                id="rcp-lender"
                className={inputClass}
                value={lender}
                onChange={(e) => {
                  setPage(1);
                  setLender(e.target.value);
                }}
                placeholder="Search lender / source…"
              />
            </div>
          )}
          <div className="min-w-[150px]">
            <label htmlFor="rcp-from" className="sr-only">
              From date
            </label>
            <input
              id="rcp-from"
              type="date"
              className={inputClass}
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
            />
          </div>
          <div className="min-w-[150px]">
            <label htmlFor="rcp-to" className="sr-only">
              To date
            </label>
            <input
              id="rcp-to"
              type="date"
              className={inputClass}
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
            />
          </div>
        </FilterPanel>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <SummaryPill label="Total Received" value={formatCurrency(summary.totalAmount)} />
        <SummaryPill label="Records" value={summary.count} />
      </div>

      {loading ? (
        <p className="mt-4 font-sans text-sm text-navy/60">Loading…</p>
      ) : error ? (
        <ErrorState title="Unable to load receipts." message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No receipts found"
          description={
            type === 'capital'
              ? 'Record partner capital contributions to track business funding.'
              : 'Record loans received from banks, partners, or other sources.'
          }
          actionLabel="Record Receipt"
          onAction={() => switchType(type)}
        />
      ) : (
        <div className="mt-4 table-wrap rounded-lg bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">{type === 'capital' ? 'Partner' : 'Lender / Source'}</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id} className="border-b border-navy/5">
                  <td className="px-4 py-3 font-mono text-sm text-navy">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 font-sans text-navy">
                    {type === 'capital' ? (r.partnerId?.name || '—') : (r.lender || '—')}
                  </td>
                  <td className="px-4 py-3 font-sans text-navy/70">{r.method}</td>
                  <td className="num px-4 py-3 font-mono text-sm text-mint">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 font-sans text-navy/70">{r.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 font-sans text-sm text-navy/60">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-navy/15 px-3 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
          >
            Prev
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-navy/15 px-3 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
