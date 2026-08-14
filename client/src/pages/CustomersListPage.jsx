import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as customerService from '../services/customer.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';

export default function CustomersListPage() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await customerService.listCustomers({ search, page, limit: 10 });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await customerService.deleteCustomer(pendingDelete._id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete customer.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Customers</h1>
        <Link
          to="/customers/new"
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
        >
          + New Customer
        </Link>
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search by name or phone…"
          className="w-full max-w-md rounded border border-navy/20 bg-white px-3 py-2 font-sans text-navy outline-none focus:border-indigo focus:ring-1 focus:ring-indigo"
        />
      </div>

      {error && (
        <div className="mt-4 rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>
      )}

      {loading ? (
        <p className="mt-8 font-mono text-sm text-navy/50">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded border border-dashed border-navy/20 p-8 text-center font-sans text-navy/50">
          No customers found.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded border border-navy/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-chalk font-mono text-xs uppercase tracking-wider text-navy/60">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {items.map((c) => (
                <tr key={c._id} className="hover:bg-chalk/50">
                  <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-navy/70">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-navy/70">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/customers/${c._id}`} className="font-sans text-indigo hover:underline">
                      View
                    </Link>
                    <Link
                      to={`/customers/${c._id}/edit`}
                      className="ml-3 font-sans text-navy/70 hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setPendingDelete(c)}
                      className="ml-3 font-sans text-orange hover:underline"
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
            className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <DeleteConfirmModal
        open={!!pendingDelete}
        name={pendingDelete?.name}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
