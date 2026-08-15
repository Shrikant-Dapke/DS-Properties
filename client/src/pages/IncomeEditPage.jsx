import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as categoryService from '../services/category.service.js';
import * as incomeService from '../services/income.service.js';
import Field, { inputClass } from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

export default function IncomeEditPage() {
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
  const [amountError, setAmountError] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [catRes, income] = await Promise.all([
        categoryService.listCategories({ type: 'income', active: 'true' }),
        incomeService.getIncome(id),
      ]);
      const active = catRes.items;
      // Preserve the current category in the list even if it later became inactive.
      const current = income.categoryId;
      const exists = current && active.some((c) => c._id === current._id);
      setCategories(exists ? active : current ? [current, ...active] : active);
      setCategoryId(current ? current._id : '');
      setAmount(income.amount != null ? String(income.amount) : '');
      setDate(income.date ? income.date.slice(0, 10) : '');
      setDescription(income.description || '');
      setReference(income.reference || '');
      setNotes(income.notes || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load income.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setAmountError('Enter an amount greater than zero.');
      return;
    }
    setAmountError('');
    setSubmitting(true);
    incomeService
      .updateIncome(id, {
        categoryId,
        amount: amount || 0,
        date,
        description: description.trim(),
        reference: reference.trim(),
        notes: notes.trim(),
      })
      .then((income) => {
        toast.success('Income updated successfully.');
        navigate(`/income/${income._id}`);
      })
      .catch((err) => {
        setSubmitting(false);
        toast.error(getErrorMessage(err, 'Failed to update income.'));
      });
  }

  if (loading) return <Spinner size="sm" className="mt-6" />;
  if (error) return <ErrorState title="Unable to load income." message={error} onRetry={load} />;

  return (
    <section className="max-w-xl">
      <Link to={`/income/${id}`} className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Income
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Edit Income</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Amount (₹)" htmlFor="amount" required error={amountError}>
          <input
            id="amount"
            type="number"
            step="any"
            min="0"
            className={inputClass}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (amountError) setAmountError('');
            }}
            required
          />
        </Field>

        <Field label="Date" htmlFor="date" required>
          <input
            id="date"
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>

        <Field
          label="Category"
          htmlFor="categoryId"
          required
          hint="Only active income categories are shown. Expense categories are not allowed."
        >
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
        </Field>

        <Field label="Description" htmlFor="description">
          <input
            id="description"
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field label="Reference" htmlFor="reference">
          <input
            id="reference"
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>

        <Field label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            to={`/income/${id}`}
            className="rounded border border-navy/20 px-4 py-2 font-sans text-navy hover:bg-navy/5"
          >
            Cancel
          </Link>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </section>
  );
}
