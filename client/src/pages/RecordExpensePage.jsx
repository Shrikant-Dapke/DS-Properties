import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as categoryService from '../services/category.service.js';
import * as expenseService from '../services/expense.service.js';
import Field, { inputClass } from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

export default function RecordExpensePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [loadingCats, setLoadingCats] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Only active expense categories are selectable. Income categories are never shown.
    categoryService
      .listCategories({ type: 'expense', active: 'true' })
      .then((r) => setCategories(r.items))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setAmountError('Enter an amount greater than zero.');
      return;
    }
    setAmountError('');
    setSubmitting(true);
    expenseService
      .createExpense({
        categoryId,
        amount: amount || 0,
        date,
        description: description.trim(),
        reference: reference.trim(),
        notes: notes.trim(),
      })
      .then((expense) => {
        toast.success('Expense recorded successfully.');
        navigate(`/expenses/${expense._id}`);
      })
      .catch((err) => {
        setSubmitting(false);
        toast.error(getErrorMessage(err, 'Failed to record expense.'));
      });
  }

  return (
    <section className="max-w-xl">
      <Link to="/expenses" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Expenses
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Record Expense</h1>

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
          hint="Only active expense categories are shown. Income categories are not allowed."
        >
          <select
            id="categoryId"
            className={inputClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            disabled={loadingCats}
          >
            <option value="">{loadingCats ? 'Loading categories…' : 'Select category…'}</option>
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
            placeholder="e.g. Road material purchase"
          />
        </Field>

        <Field label="Reference" htmlFor="reference">
          <input
            id="reference"
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. INV-RC-001"
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
            to="/expenses"
            className="rounded border border-navy/20 px-4 py-2 font-sans text-navy hover:bg-navy/5"
          >
            Cancel
          </Link>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving…' : 'Record Expense'}
          </Button>
        </div>
      </form>
    </section>
  );
}
