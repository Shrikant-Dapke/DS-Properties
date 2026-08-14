import { useEffect, useState } from 'react';
import * as categoryService from '../services/category.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';

const typeBadge = {
  expense: 'bg-indigo/10 text-indigo',
  income: 'bg-mint/15 text-mint',
};

const emptyForm = { name: '', type: 'expense', notes: '', active: true };

export default function CategoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [type, setType] = useState('');
  const [active, setActive] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    const params = {};
    if (type) params.type = type;
    if (active) params.active = active;
    categoryService
      .listCategories(params)
      .then((r) => setItems(r.items))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load categories.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [type, active]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setNotice('');
    setShowForm(true);
  }

  function openEdit(cat) {
    setEditing(cat._id);
    setForm({
      name: cat.name,
      type: cat.type,
      notes: cat.notes || '',
      active: cat.active,
    });
    setError('');
    setNotice('');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function submitForm(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      type: form.type,
      notes: form.notes.trim(),
      active: form.active,
    };
    try {
      if (editing) {
        const updated = await categoryService.updateCategory(editing, payload);
        setItems((prev) => prev.map((c) => (c._id === editing ? updated : c)));
        setNotice('Category updated.');
      } else {
        const created = await categoryService.createCategory(payload);
        setItems((prev) => [...prev, created]);
        setNotice('Category created.');
      }
      cancelForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(cat) {
    setError('');
    try {
      const updated = await categoryService.updateCategory(cat._id, { active: !cat.active });
      setItems((prev) => prev.map((c) => (c._id === cat._id ? updated : c)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update category.');
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError('');
    try {
      await categoryService.deleteCategory(pendingDelete._id);
      setItems((prev) => prev.filter((c) => c._id !== pendingDelete._id));
      setNotice(`Category "${pendingDelete.name}" deleted.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete category.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Categories</h1>
        {!showForm && (
          <button
            onClick={openCreate}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
          >
            New Category
          </button>
        )}
      </div>

      {!showForm && (
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <select
            className="rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
            value={active}
            onChange={(e) => setActive(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-4 rounded border border-mint bg-mint/10 px-3 py-2 text-sm text-mint">
          {notice}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={submitForm}
          className="mt-4 rounded-lg bg-white p-6 shadow-sm"
        >
          <h2 className="font-display text-xl text-navy">
            {editing ? 'Edit Category' : 'New Category'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-sans text-sm text-navy/70">Name</span>
              <input
                className="mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Category name"
                required
              />
            </label>
            <label className="block">
              <span className="font-sans text-sm text-navy/70">Type</span>
              <select
                className="mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="font-sans text-sm text-navy/70">Notes</span>
              <input
                className="mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 accent-indigo"
              />
              <span className="font-sans text-sm text-navy/70">Active</span>
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={cancelForm}
              className="rounded border border-navy/20 px-4 py-2 font-sans text-navy hover:bg-navy/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <>
          {loading ? (
            <p className="mt-6 font-mono text-sm text-navy/50">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-6 font-sans text-navy/60">No categories found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c._id} className="border-b border-navy/5 hover:bg-navy/5">
                      <td className="px-4 py-3 font-sans font-medium text-navy">
                        {c.name}
                        {c.isSeed && (
                          <span className="ml-2 rounded bg-lavender/15 px-2 py-0.5 font-sans text-xs text-lavender">
                            Seed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-1 font-sans text-xs ${
                            typeBadge[c.type] || 'bg-navy/5 text-navy'
                          }`}
                        >
                          {c.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-navy/70">
                        {c.active ? (
                          <span className="text-mint">Active</span>
                        ) : (
                          <span className="text-orange">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-sans text-navy/70">{c.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleActive(c)}
                          className="rounded border border-navy/15 px-2 py-1 font-sans text-xs text-navy hover:bg-navy/5"
                        >
                          {c.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="ml-2 rounded border border-navy/15 px-2 py-1 font-sans text-xs text-navy hover:bg-navy/5"
                        >
                          Edit
                        </button>
                        {!c.isSeed && (
                          <button
                            onClick={() => setPendingDelete(c)}
                            className="ml-2 rounded border border-orange/40 px-2 py-1 font-sans text-xs text-orange hover:bg-orange/10"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <DeleteConfirmModal
        open={!!pendingDelete}
        name={pendingDelete ? pendingDelete.name : ''}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
