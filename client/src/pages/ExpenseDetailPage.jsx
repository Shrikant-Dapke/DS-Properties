import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as expenseService from '../services/expense.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useDelete } from '../hooks/useDelete.js';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency } from '../utils/format.js';

export default function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { pendingDelete, deleting, askDelete, cancelDelete, confirmDelete } = useDelete({
    deleteFn: () => expenseService.deleteExpense(id),
    successMessage: 'Expense soft-deleted.',
    errorMessage: 'Failed to delete expense.',
    onSuccess: () => setExpense((prev) => (prev ? { ...prev, deleted: true } : prev)),
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError('');
    await expenseService
      .getExpense(id, { includeDeleted: true })
      .then(setExpense)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load expense.')))
      .finally(() => setLoading(false));
  }



  if (loading) return <Spinner size="sm" className="mt-6" />;
  if (error)
    return <ErrorState title="Unable to load expense." message={error} onRetry={load} />;
  if (!expense) return null;

  const rows = [
    ['Category', expense.categoryId ? expense.categoryId.name : '—'],
    ['Amount', formatCurrency(expense.amount)],
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
        {expense.deleted && <Badge color="orange">Deleted</Badge>}
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
          <Button variant="danger" onClick={() => askDelete()}>
            Delete
          </Button>
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
        onCancel={cancelDelete}
        busy={deleting}
      />
    </section>
  );
}
