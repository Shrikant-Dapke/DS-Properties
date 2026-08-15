import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as expenseService from '../services/expense.service.js';
import * as categoryService from '../services/category.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import Badge from '../components/Badge.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency } from '../utils/format.js';

export default function ExpensesListPage() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    categoryService
      .listCategories({ type: 'expense' })
      .then((r) => setCategories(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, dateFrom, dateTo, showDeleted, page]);

  async function load() {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (category) params.category = category;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (showDeleted) params.deleted = 'all';
    expenseService
      .listExpenses(params)
      .then((r) => {
        setExpenses(r.items);
        setPagination(r.pagination);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load expenses.')))
      .finally(() => setLoading(false));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await expenseService.deleteExpense(pendingDelete._id);
      setExpenses((prev) =>
        prev.map((e) => (e._id === pendingDelete._id ? { ...e, deleted: true } : e))
      );
      setPendingDelete(null);
      toast.success('Expense soft-deleted.');
    } catch (err) {
      setPendingDelete(null);
      setDeleting(false);
      toast.error(getErrorMessage(err, 'Failed to delete expense.'));
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Expenses</h1>
        <Link
          to="/expenses/new"
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
        >
          Record Expense
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <select
          className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
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
        <label className="flex items-center gap-2 font-sans text-sm text-navy/70">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => {
              setShowDeleted(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-orange"
          />
          Show deleted
        </label>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load expenses." message={error} onRetry={load} />
      ) : expenses.length === 0 ? (
        category || dateFrom || dateTo ? (
          <EmptyState title="No expenses match your filters" description="Try adjusting the filters above." />
        ) : (
          <EmptyState
            title="No expenses recorded"
            description="Record your first expense to start tracking spending."
            actionLabel="Record Expense"
            onAction={() => navigate('/expenses/new')}
          />
        )
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr
                    key={e._id}
                    onClick={() => navigate(`/expenses/${e._id}`)}
                    className={`cursor-pointer border-b border-navy/5 hover:bg-navy/5 ${
                      e.deleted ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-navy">
                      {e.date ? new Date(e.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 font-sans text-navy">
                      <span className="inline-flex items-center gap-2">
                        {e.categoryId?.name || '—'}
                        {e.deleted && <Badge color="orange">Deleted</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-navy/80">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-mint">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3 font-sans text-navy/70">{e.reference || '—'}</td>
                    <td className="px-4 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex justify-end gap-3 font-sans text-sm">
                        <Link
                          to={`/expenses/${e._id}`}
                          className="text-lavender hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          to={`/expenses/${e._id}/edit`}
                          className="text-indigo hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => setPendingDelete(e)}
                          disabled={e.deleted}
                          className="text-orange hover:underline disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
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
        name={pendingDelete?.description || 'this expense'}
        title="Delete expense?"
        message={
          pendingDelete ? (
            <>
              This will soft-delete{' '}
              <span className="font-medium text-navy">{pendingDelete.description || 'this expense'}</span>.
              It remains in the database but will be hidden from normal views.
            </>
          ) : null
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        busy={deleting}
      />
    </section>
  );
}
