import { useState } from 'react';
import Field, { inputClass } from '../components/Field.jsx';
import Button from '../components/Button.jsx';

const STATUS_OPTIONS = ['Active', 'Inactive'];

export default function PartnerForm({ initialValues = {}, onSubmit, submitting = false, error = '' }) {
  const [form, setForm] = useState({
    name: initialValues.name || '',
    phone: initialValues.phone || '',
    email: initialValues.email || '',
    address: initialValues.address || '',
    notes: initialValues.notes || '',
    status: initialValues.status || 'Active',
  });
  const [nameError, setNameError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    await onSubmit({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      status: form.status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>
      )}

      <Field label="Name" htmlFor="name" required error={nameError}>
        <input
          id="name"
          className={inputClass}
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </Field>

      <Field label="Phone" htmlFor="phone">
        <input
          id="phone"
          className={inputClass}
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
        />
      </Field>

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          type="email"
          className={inputClass}
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </Field>

      <Field label="Address" htmlFor="address">
        <input
          id="address"
          className={inputClass}
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
        />
      </Field>

      <Field label="Status" htmlFor="status">
        <select
          id="status"
          className={inputClass}
          value={form.status}
          onChange={(e) => update('status', e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
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
          onChange={(e) => update('notes', e.target.value)}
        />
      </Field>

      <Button type="submit" loading={submitting}>
        {submitting ? 'Saving…' : 'Save Partner'}
      </Button>
    </form>
  );
}
