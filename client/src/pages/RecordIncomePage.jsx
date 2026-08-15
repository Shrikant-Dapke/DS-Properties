import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as categoryService from '../services/category.service.js';
import * as incomeService from '../services/income.service.js';

const labelClass = 'block font-mono text-xs uppercase tracking-wider text-navy/50';
const inputClass =
  'mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none';

export default function RecordIncomePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    // Only active income categories are selectable. Expense categories are never shown.
    categoryService
      .listCategories({ type: 'income', active: 'true' })
      .then((r) => setCategories(r.items))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    incomeService
      .createIncome({
        categoryId,
        amount: amount || 0,
        date,
        description: description.trim(),
        reference: reference.trim(),
        notes: notes.trim(),
      })
      .then((income) => navigate(`/income/${income._id}`))
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to record income.');
        setSubmitting(false);
      });
  }

  return (
    <section className="max-w-xl">
      <Link to="/income" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Other Income
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Record Income</h1>
      <p className="mt-1 font-sans text-sm text-navy/60">
        Record other business receipts (commission, rent, resale profit, etc.). Customer plot
        installments are recorded as payments, not here.
      </p>

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
            disabled={loadingCats}
          >
            <option value="">{loadingCats ? 'Loading categories…' : 'Select category…'}</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 font-sans text-xs text-navy/50">
            Only active income categories are shown. Expense categories are not allowed.
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
            placeholder="e.g. Resale profit from plot 12"
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
            placeholder="e.g. RCT-001"
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
            to="/income"
            className="rounded border border-navy/20 px-4 py-2 font-sans text-navy hover:bg-navy/5"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Record Income'}
          </button>
        </div>
      </form>
    </section>
  );
}
