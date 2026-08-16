import { useEffect, useState } from 'react';
import Field, { inputClass } from '../components/Field.jsx';
import Button from '../components/Button.jsx';

const STATUSES = ['Available', 'Reserved', 'Allocated', 'Sold'];

export default function PlotForm({ initialValues, customers, onSubmit, submitting, error }) {
  const [form, setForm] = useState({
    plotNumber: '',
    area: '',
    areaUnit: '',
    location: '',
    price: '',
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

      <Field label="Plot Number" htmlFor="plotNumber" required>
        <input
          id="plotNumber"
          className={inputClass}
          value={form.plotNumber}
          onChange={(e) => set('plotNumber', e.target.value)}
          required
        />
      </Field>

      <div className="flex gap-4">
        <Field label="Area" htmlFor="area" className="flex-1">
          <input
            id="area"
            type="number"
            className={inputClass}
            value={form.area}
            onChange={(e) => set('area', e.target.value)}
          />
        </Field>
        <Field label="Area Unit" htmlFor="areaUnit" className="flex-1">
          <input
            id="areaUnit"
            className={inputClass}
            placeholder="sq.yd"
            value={form.areaUnit}
            onChange={(e) => set('areaUnit', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Location" htmlFor="location">
        <input
          id="location"
          className={inputClass}
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
        />
      </Field>

      <div className="flex gap-4">
        <Field label="Plot Price" htmlFor="price" required className="flex-1">
          <input
            id="price"
            type="number"
            step="any"
            className={inputClass}
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Status" htmlFor="status">
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
      </Field>

      <Field label="Customer" htmlFor="customerId">
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
      </Field>

      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          rows={3}
          className={inputClass}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </Field>

      <Button type="submit" loading={submitting}>
        {submitting ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
