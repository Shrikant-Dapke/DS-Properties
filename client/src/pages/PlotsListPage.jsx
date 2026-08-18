import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as plotService from '../services/plot.service.js';
import * as customerService from '../services/customer.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import Pagination from '../components/Pagination.jsx';
import Badge from '../components/Badge.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import { useDelete } from '../hooks/useDelete.js';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency } from '../utils/format.js';

const STATUSES = ['Available', 'Reserved', 'Allocated', 'Sold'];

const statusBadge = {
  Available: 'navy',
  Reserved: 'lavender',
  Allocated: 'indigo',
  Sold: 'mint',
};

const inputClass =
  'w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy outline-none transition-colors focus:border-indigo focus:ring-1 focus:ring-indigo';

export default function PlotsListPage() {
  const navigate = useNavigate();
  const [plots, setPlots] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [customer, setCustomer] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const { pendingDelete, deleting, askDelete, cancelDelete, confirmDelete } = useDelete({
    deleteFn: (item) => plotService.deletePlot(item._id),
    successMessage: 'Plot deleted successfully.',
    errorMessage: 'Failed to delete plot.',
    onSuccess: (item) => setPlots((prev) => prev.filter((p) => p._id !== item._id)),
  });

  useEffect(() => {
    customerService
      .listCustomers({ limit: 200 })
      .then((r) => setCustomers(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, customer, page]);

  async function load() {
    setLoading(true);
    const params = { page, limit: 20 };
    if (search.trim()) params.search = search.trim();
    if (status) params.status = status;
    if (customer) params.customer = customer;
    plotService
      .listPlots(params)
      .then((r) => {
        setPlots(r.items);
        setPagination(r.pagination);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load plots.')))
      .finally(() => setLoading(false));
  }

  const activeCount = (search ? 1 : 0) + (status ? 1 : 0) + (customer ? 1 : 0);
  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setCustomer('');
    setPage(1);
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Plots</h1>
        <Link
          to="/plots/new"
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white transition-colors duration-150 hover:bg-indigo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
        >
          New Plot
        </Link>
      </div>

      <div className="mt-4">
        <FilterPanel activeCount={activeCount} onClear={clearFilters}>
          <div className="min-w-[180px] flex-1">
            <label htmlFor="plot-search" className="sr-only">
              Search plot number
            </label>
            <input
              id="plot-search"
              className={inputClass}
              placeholder="Search plot number…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="min-w-[160px]">
            <label htmlFor="plot-status" className="sr-only">
              Filter by status
            </label>
            <select
              id="plot-status"
              className={inputClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label htmlFor="plot-customer" className="sr-only">
              Filter by customer
            </label>
            <select
              id="plot-customer"
              className={inputClass}
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
          </div>
        </FilterPanel>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load plots." message={error} onRetry={load} />
      ) : plots.length === 0 ? (
        search.trim() || status || customer ? (
          <EmptyState title="No plots match your filters" description="Try clearing the search or filters." />
        ) : (
          <EmptyState
            title="No plots yet"
            description="Create your first plot to start tracking sales."
            actionLabel="New Plot"
            onAction={() => navigate('/plots/new')}
          />
        )
      ) : (
        <>
          <div className="mt-4 table-wrap rounded-lg bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                  <th className="px-4 py-3">Plot #</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3">Customer</th>
                </tr>
              </thead>
              <tbody>
                {plots.map((p) => (
                  <tr
                    key={p._id}
                    onClick={() => navigate(`/plots/${p._id}`)}
                    className="cursor-pointer border-b border-navy/5 hover:bg-navy/5"
                  >
                    <td className="px-4 py-3 font-sans font-medium text-navy">{p.plotNumber}</td>
                    <td className="px-4 py-3">
                      <Badge color={statusBadge[p.status] || 'navy'}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 font-sans text-navy/70">{p.location || '—'}</td>
                    <td className="num px-4 py-3 font-mono text-sm text-navy">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3 font-sans text-navy/70">{p.customerId?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} className="justify-end" />
        </>
      )}

      <DeleteConfirmModal
        open={!!pendingDelete}
        name={pendingDelete ? `Plot ${pendingDelete.plotNumber}` : ''}
        busy={deleting}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
