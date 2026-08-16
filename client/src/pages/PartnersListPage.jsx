import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as partnerService from '../services/partner.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import Badge from '../components/Badge.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

const STATUS_OPTIONS = ['All', 'Active', 'Inactive'];

export default function PartnersListPage() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await partnerService.listPartners({ search, status, page, limit: 10 });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load partners.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await partnerService.deletePartner(pendingDelete._id);
      setPendingDelete(null);
      toast.success('Partner deleted successfully.');
      load();
    } catch (err) {
      setPendingDelete(null);
      setDeleting(false);
      toast.error(getErrorMessage(err, 'Failed to delete partner.'));
    }
  }

  const activeCount = (search ? 1 : 0) + (status !== 'All' ? 1 : 0);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Partners</h1>
        <Link
          to="/partners/new"
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white transition-colors duration-150 hover:bg-indigo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
        >
          + New Partner
        </Link>
      </div>

      <div className="mt-4">
        <FilterPanel activeCount={activeCount} onClear={() => { setSearch(''); setStatus('All'); setPage(1); }}>
          <div className="min-w-[220px] flex-1">
            <label htmlFor="partner-search" className="sr-only">
              Search partners
            </label>
            <input
              id="partner-search"
              type="search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by name, phone or email…"
              className="w-full rounded border border-navy/20 bg-white px-3 py-2 font-sans text-navy outline-none transition-colors focus:border-indigo focus:ring-1 focus:ring-indigo"
            />
          </div>
          <div className="min-w-[150px]">
            <label htmlFor="partner-status" className="sr-only">
              Filter by status
            </label>
            <select
              id="partner-status"
              className="rounded border border-navy/20 bg-white px-3 py-2 font-sans text-navy outline-none transition-colors focus:border-indigo focus:ring-1 focus:ring-indigo"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
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
        <ErrorState title="Unable to load partners." message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No partners yet"
          description="Add a partner to track capital contributions and business funding."
          actionLabel="New Partner"
          onAction={() => navigate('/partners/new')}
        />
      ) : (
        <div className="mt-4 table-wrap rounded border border-navy/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-chalk font-mono text-xs uppercase tracking-wider text-navy/60">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {items.map((p) => (
                <tr key={p._id} className="hover:bg-chalk/50">
                  <td className="px-4 py-3 font-medium text-navy">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-navy/70">{p.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge color={p.status === 'Active' ? 'mint' : 'navy'}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/partners/${p._id}`} className="font-sans text-indigo hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2">
                      View
                    </Link>
                    <Link
                      to={`/partners/${p._id}/edit`}
                      className="ml-3 font-sans text-navy/70 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setPendingDelete(p)}
                      className="ml-3 font-sans text-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 font-sans text-sm text-navy/70">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
          >
            Prev
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
          >
            Next
          </button>
        </div>
      )}

      <DeleteConfirmModal
        open={!!pendingDelete}
        name={pendingDelete?.name}
        message="This partner cannot be deleted while they have capital contributions on record. Reassign or remove those contributions first."
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
