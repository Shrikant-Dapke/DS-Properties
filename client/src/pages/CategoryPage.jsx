import { useEffect, useState } from 'react';
import * as categoryService from '../services/category.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

const typeBadge = {
  expense: 'indigo',
  income: 'mint',
};

const emptyForm = { name: '', type: 'expense', notes: '', active: true };

export default function CategoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState('');
  const [active, setActive] = useState('');
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    const params = {};
    if (type) params.type = type;
    if (active) params.active = active;
    categoryService
      .listCategories(params)
      .then((r) => setItems(r.items))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load categories.')))
      .finally(() => setLoading(false));
  }

  useEffect(load, [type, active]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
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
        toast.success('Category updated.');
      } else {
        const created = await categoryService.createCategory(payload);
        setItems((prev) => [...prev, created]);
        toast.success('Category created.');
      }
      cancelForm();
    } catch (err) {
      setSaving(false);
      toast.error(getErrorMessage(err, 'Failed to save category.'));
    }
  }

  async function toggleActive(cat) {
    try {
      const updated = await categoryService.updateCategory(cat._id, { active: !cat.active });
      setItems((prev) => prev.map((c) => (c._id === cat._id ? updated : c)));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update category.'));
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const name = pendingDelete.name;
      await categoryService.deleteCategory(pendingDelete._id);
      setItems((prev) => prev.filter((c) => c._id !== pendingDelete._id));
      setPendingDelete(null);
      toast.success(`Category "${name}" deleted.`);
    } catch (err) {
      setPendingDelete(null);
      setDeleting(false);
      toast.error(getErrorMessage(err, 'Failed to delete category.'));
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

      {showForm && (
        <Card className="mt-4 p-6">
        <form
          onSubmit={submitForm}
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
        </Card>
      )}

      {!showForm && (
        <>
      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load categories." message={error} onRetry={load} />
      ) : items.length === 0 ? (
        type || active ? (
          <EmptyState title="No categories match your filters" description="Try clearing the filters above." />
        ) : (
          <EmptyState title="No categories yet" description="Create a category to organize transactions." actionLabel="New Category" onAction={openCreate} />
        )
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
                        {c.isSeed && <Badge color="lavender" className="ml-2">Seed</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={typeBadge[c.type] || 'navy'}>{c.type}</Badge>
                      </td>
                      <td className="px-4 py-3 font-sans text-navy/70">
                        <Badge color={c.active ? 'mint' : 'orange'}>
                          {c.active ? 'Active' : 'Inactive'}
                        </Badge>
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
