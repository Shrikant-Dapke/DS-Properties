import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as plotService from '../services/plot.service.js';
import * as customerService from '../services/customer.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';

const STATUSES = ['Available', 'Reserved', 'Allocated', 'Sold'];

const statusBadge = {
  Available: 'bg-navy/5 text-navy',
  Reserved: 'bg-lavender/15 text-lavender',
  Allocated: 'bg-indigo/10 text-indigo',
  Sold: 'bg-mint/15 text-mint',
};

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
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    customerService
      .listCustomers({ limit: 200 })
      .then((r) => setCustomers(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
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
      .catch((err) => setError(err.response?.data?.message || 'Failed to load plots.'))
      .finally(() => setLoading(false));
  }, [search, status, customer, page]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await plotService.deletePlot(pendingDelete._id);
      setPlots((prev) => prev.filter((p) => p._id !== pendingDelete._id));
      setPendingDelete(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete plot.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Plots</h1>
        <Link
          to="/plots/new"
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
        >
          New Plot
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          className="flex-1 rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
          placeholder="Search plot number…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
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
      </div>

      {error && (
        <div className="mt-4 rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6 font-mono text-sm text-navy/50">Loading…</p>
      ) : plots.length === 0 ? (
        <p className="mt-6 font-sans text-navy/60">No plots found.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                  <th className="px-4 py-3">Plot #</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Price</th>
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
                      <span
                        className={`rounded px-2 py-1 font-sans text-xs ${
                          statusBadge[p.status] || 'bg-navy/5 text-navy'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-navy/70">{p.location || '—'}</td>
                    <td className="px-4 py-3 font-mono text-sm text-navy">{p.price}</td>
                    <td className="px-4 py-3 font-sans text-navy/70">
                      {p.customerId?.name || '—'}
                    </td>
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

      <DeleteConfirmModal
        open={!!pendingDelete}
        name={pendingDelete ? `Plot ${pendingDelete.plotNumber}` : ''}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
