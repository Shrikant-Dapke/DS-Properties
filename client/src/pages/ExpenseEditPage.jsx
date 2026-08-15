import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as categoryService from '../services/category.service.js';
import * as expenseService from '../services/expense.service.js';

const labelClass = 'block font-mono text-xs uppercase tracking-wider text-navy/50';
const inputClass =
  'mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none';

export default function ExpenseEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      categoryService.listCategories({ type: 'expense', active: 'true' }),
      expenseService.getExpense(id, { includeDeleted: true }),
    ])
      .then(([catRes, expense]) => {
        const active = catRes.items;
        // Preserve the current category in the list even if it later became inactive.
        const current = expense.categoryId;
        const exists = current && active.some((c) => c._id === current._id);
        setCategories(exists ? active : current ? [current, ...active] : active);
        setCategoryId(current ? current._id : '');
        setAmount(expense.amount != null ? String(expense.amount) : '');
        setDate(expense.date ? expense.date.slice(0, 10) : '');
        setDescription(expense.description || '');
        setReference(expense.reference || '');
        setNotes(expense.notes || '');
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load expense.'))
      .finally(() => setLoading(false));
  }, [id]);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    expenseService
      .updateExpense(id, {
        categoryId,
        amount: amount || 0,
        date,
        description: description.trim(),
        reference: reference.trim(),
        notes: notes.trim(),
      })
      .then((expense) => navigate(`/expenses/${expense._id}`))
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to update expense.');
        setSubmitting(false);
      });
  }

  if (loading) return <p className="font-mono text-sm text-navy/50">Loading…</p>;

  return (
    <section className="max-w-xl">
      <Link to={`/expenses/${id}`} className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Expense
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Edit Expense</h1>

      {error && (
        <div className="mt-4 rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className={labelClass} htmlFor="amount">
            Amount (₹) *
          </label>
          <input
            id="amount"
            type="number"
            step="any"
            min="0"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="date">
            Date *
          </label>
          <input
            id="date"
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="categoryId">
            Category *
          </label>
          <select
            id="categoryId"
            className={inputClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 font-sans text-xs text-navy/50">
            Only active expense categories are shown. Income categories are not allowed.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="description">
            Description
          </label>
          <input
            id="description"
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="reference">
            Reference
          </label>
          <input
            id="reference"
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            to={`/expenses/${id}`}
            className="rounded border border-navy/20 px-4 py-2 font-sans text-navy hover:bg-navy/5"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}
