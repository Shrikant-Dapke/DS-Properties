import { useEffect, useState } from 'react';

const STATUSES = ['Available', 'Reserved', 'Allocated', 'Sold'];

const labelClass = 'block font-mono text-xs uppercase tracking-wider text-navy/50';
const inputClass =
  'mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none';

export default function PlotForm({ initialValues, customers, onSubmit, submitting, error }) {
  const [form, setForm] = useState({
    plotNumber: '',
    area: '',
    areaUnit: '',
    location: '',
    price: '',
    agreementAmount: '',
    status: 'Available',
    customerId: '',
    notes: '',
    ...initialValues,
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, ...initialValues }));
  }, [initialValues]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      plotNumber: form.plotNumber,
      price: form.price,
      agreementAmount: form.agreementAmount || null,
      status: form.status,
      customerId: form.customerId || null,
    };
    if (form.area) payload.area = Number(form.area);
    if (form.areaUnit) payload.areaUnit = form.areaUnit;
    if (form.location) payload.location = form.location;
    if (form.notes) payload.notes = form.notes;
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      {error && (
        <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">
          {error}
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="plotNumber">
          Plot Number *
        </label>
        <input
          id="plotNumber"
          className={inputClass}
          value={form.plotNumber}
          onChange={(e) => set('plotNumber', e.target.value)}
          required
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className={labelClass} htmlFor="area">
            Area
          </label>
          <input
            id="area"
            type="number"
            className={inputClass}
            value={form.area}
            onChange={(e) => set('area', e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="areaUnit">
            Area Unit
          </label>
          <input
            id="areaUnit"
            className={inputClass}
            placeholder="sq.yd"
            value={form.areaUnit}
            onChange={(e) => set('areaUnit', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="location">
          Location
        </label>
        <input
          id="location"
          className={inputClass}
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className={labelClass} htmlFor="price">
            Price *
          </label>
          <input
            id="price"
            type="number"
            step="any"
            className={inputClass}
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            required
          />
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="agreementAmount">
            Agreement Amount
          </label>
          <input
            id="agreementAmount"
            type="number"
            step="any"
            className={inputClass}
            value={form.agreementAmount}
            onChange={(e) => set('agreementAmount', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="status">
          Status
        </label>
        <select
          id="status"
          className={inputClass}
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="customerId">
          Customer
        </label>
        <select
          id="customerId"
          className={inputClass}
          value={form.customerId || ''}
          onChange={(e) => set('customerId', e.target.value)}
        >
          <option value="">Unassigned</option>
          {customers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          className={inputClass}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90 disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
