import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as paymentService from '../services/payment.service.js';
import * as customerService from '../services/customer.service.js';
import * as plotService from '../services/plot.service.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency } from '../utils/format.js';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

export default function PaymentsListPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState('');
  const [plot, setPlot] = useState('');
  const [method, setMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  useEffect(() => {
    customerService.listCustomers({ limit: 200 }).then((r) => setCustomers(r.items)).catch(() => {});
    plotService.listPlots({ limit: 200 }).then((r) => setPlots(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, plot, method, dateFrom, dateTo, page]);

  async function load() {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (customer) params.customer = customer;
    if (plot) params.plot = plot;
    if (method) params.method = method;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    paymentService
      .listPayments(params)
      .then((r) => {
        setPayments(r.items);
        setPagination(r.pagination);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load payments.')))
      .finally(() => setLoading(false));
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Payments</h1>
        <Link
          to="/payments/new"
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
        >
          Record Payment
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
          value={customer}
          onChange={(e) => {
            setCustomer(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All customers</option>
          {customers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
          value={plot}
          onChange={(e) => {
            setPlot(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All plots</option>
          {plots.map((p) => (
            <option key={p._id} value={p._id}>
              {p.plotNumber}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All methods</option>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load payments." message={error} onRetry={load} />
      ) : payments.length === 0 ? (
        customer || plot || method || dateFrom || dateTo ? (
          <EmptyState title="No payments match your filters" description="Try adjusting the filters above." />
        ) : (
          <EmptyState
            title="No payments recorded"
            description="Record your first payment to start tracking collections."
            actionLabel="Record Payment"
            onAction={() => navigate('/payments/new')}
          />
        )
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Plot</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p._id}
                    onClick={() => navigate(`/payments/${p._id}`)}
                    className="cursor-pointer border-b border-navy/5 hover:bg-navy/5"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-navy">
                      {p.date ? new Date(p.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 font-sans text-navy">
                      {p.customerId?.name || '—'}
                    </td>
                    <td className="px-4 py-3 font-sans text-navy">
                      {p.plotId?.plotNumber || '—'}
                    </td>
                     <td className="px-4 py-3 font-mono text-sm text-mint">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 font-sans text-navy/70">{p.method}</td>
                    <td className="px-4 py-3 font-sans text-navy/70">{p.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3 font-sans text-sm text-navy/60">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-navy/15 px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-navy/15 px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
