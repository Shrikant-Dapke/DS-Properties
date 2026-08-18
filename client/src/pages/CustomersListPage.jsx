import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as customerService from '../services/customer.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import Pagination from '../components/Pagination.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import { useDelete } from '../hooks/useDelete.js';
import { getErrorMessage } from '../utils/errorMessage.js';

export default function CustomersListPage() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const { pendingDelete, deleting, askDelete, cancelDelete, confirmDelete } = useDelete({
    deleteFn: (item) => customerService.deleteCustomer(item._id),
    successMessage: 'Customer deleted successfully.',
    errorMessage: 'Failed to delete customer.',
    onSuccess: () => load(),
  });
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await customerService.listCustomers({ search, page, limit: 10 });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load customers.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);



  const activeCount = search ? 1 : 0;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Customers</h1>
        <Link
          to="/customers/new"
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white transition-colors duration-150 hover:bg-indigo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
        >
          + New Customer
        </Link>
      </div>

      <div className="mt-4">
        <FilterPanel activeCount={activeCount} onClear={() => { setSearch(''); setPage(1); }}>
          <div className="min-w-[220px] flex-1">
            <label htmlFor="customer-search" className="sr-only">
              Search customers
            </label>
            <input
              id="customer-search"
              type="search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by name or phone…"
              className="w-full rounded border border-navy/20 bg-white px-3 py-2 font-sans text-navy outline-none transition-colors focus:border-indigo focus:ring-1 focus:ring-indigo"
            />
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
        <ErrorState title="Unable to load customers." message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to start managing plots and payments."
          actionLabel="New Customer"
          onAction={() => navigate('/customers/new')}
        />
      ) : (
        <div className="mt-4 table-wrap rounded border border-navy/10 bg-white">
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
                    <Link to={`/customers/${c._id}`} className="font-sans text-indigo hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2">
                      View
                    </Link>
                    <Link
                      to={`/customers/${c._id}/edit`}
                      className="ml-3 font-sans text-navy/70 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => askDelete(c)}
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

      <Pagination
        page={page}
        totalPages={pagination?.totalPages || 1}
        onPageChange={setPage}
        buttonClassName="rounded border border-navy/20 px-3 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
      />

      <DeleteConfirmModal
        open={!!pendingDelete}
        name={pendingDelete?.name}
        busy={deleting}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
