import { useState } from 'react';

export default function CustomerForm({ initialValues = {}, onSubmit, submitting = false, error = '' }) {
  const [form, setForm] = useState({
    name: initialValues.name || '',
    phone: initialValues.phone || '',
    email: initialValues.email || '',
    address: initialValues.address || '',
    notes: initialValues.notes || '',
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
    });
  }

  const inputClass =
    'w-full rounded border border-navy/20 bg-white px-3 py-2 font-sans text-navy outline-none focus:border-indigo focus:ring-1 focus:ring-indigo';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>
      )}

      <div>
        <label className="mb-1 block font-sans text-sm text-navy/70" htmlFor="name">Name *</label>
        <input id="name" className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} />
        {nameError && <p className="mt-1 text-xs text-orange">{nameError}</p>}
      </div>

      <div>
        <label className="mb-1 block font-sans text-sm text-navy/70" htmlFor="phone">Phone</label>
        <input id="phone" className={inputClass} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block font-sans text-sm text-navy/70" htmlFor="email">Email</label>
        <input id="email" type="email" className={inputClass} value={form.email} onChange={(e) => update('email', e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block font-sans text-sm text-navy/70" htmlFor="address">Address</label>
        <input id="address" className={inputClass} value={form.address} onChange={(e) => update('address', e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block font-sans text-sm text-navy/70" htmlFor="notes">Notes</label>
        <textarea id="notes" rows={3} className={inputClass} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white transition-colors duration-200 hover:bg-indigo/90 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save Customer'}
      </button>
    </form>
  );
}
