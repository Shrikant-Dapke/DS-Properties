import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as expenseService from '../services/expense.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';

function formatAmount(value) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    expenseService
      .getExpense(id, { includeDeleted: true })
      .then(setExpense)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load expense.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function confirmDelete() {
    setDeleting(true);
    setError('');
    try {
      await expenseService.deleteExpense(id);
      setExpense((prev) => (prev ? { ...prev, deleted: true } : prev));
      setPendingDelete(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete expense.');
      setPendingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="font-mono text-sm text-navy/50">Loading…</p>;
  if (error)
    return <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>;
  if (!expense) return null;

  const rows = [
    ['Category', expense.categoryId ? expense.categoryId.name : '—'],
    ['Amount', formatAmount(expense.amount)],
    ['Date', expense.date ? new Date(expense.date).toLocaleDateString() : '—'],
    ['Description', expense.description || '—'],
    ['Reference', expense.reference || '—'],
    ['Notes', expense.notes || '—'],
    ['Status', expense.deleted ? 'Deleted (soft)' : 'Active'],
    ['Created', expense.createdAt ? new Date(expense.createdAt).toLocaleString() : '—'],
    ['Updated', expense.updatedAt ? new Date(expense.updatedAt).toLocaleString() : '—'],
  ];

  return (
    <section className="max-w-xl">
      <Link to="/expenses" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Expenses
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Expense</h1>
        {expense.deleted && (
          <span className="rounded bg-orange/15 px-2 py-1 font-mono text-xs uppercase tracking-wider text-orange">
            Deleted
          </span>
        )}
      </div>

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
        {!expense.deleted && (
          <Link
            to={`/expenses/${expense._id}/edit`}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
          >
            Edit
          </Link>
        )}
        {!expense.deleted && (
          <button
            onClick={() => setPendingDelete(true)}
            className="rounded bg-orange px-4 py-2 font-sans font-medium text-white hover:bg-orange/90"
          >
            Delete
          </button>
        )}
      </div>

      <DeleteConfirmModal
        open={pendingDelete}
        name={expense.description || 'this expense'}
        title="Delete expense?"
        message={
          <>
            This will soft-delete{' '}
            <span className="font-medium text-navy">{expense.description || 'this expense'}</span>. It
            remains in the database but will be hidden from normal views.
          </>
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(false)}
        busy={deleting}
      />
    </section>
  );
}
