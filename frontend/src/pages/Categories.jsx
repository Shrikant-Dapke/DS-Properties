import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { categoryApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Card } from '../components/common/Card.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { isAdmin } from '../contexts/authContextDef.js';

const empty = { name: '', slug: '', description: '', sortOrder: 0, isActive: true };

export default function Categories() {
  const toast = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await categoryApi.list({ limit: 100 });
      setRows(data.rows || []);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name,
      slug: row.slug || '',
      description: row.description || '',
      sortOrder: row.sortOrder ?? 0,
      isActive: row.isActive,
    });
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        payload.isActive = form.isActive;
        await categoryApi.update(editing.publicId, payload);
        toast.success('Category updated');
      } else {
        await categoryApi.create(payload);
        toast.success('Category added');
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await categoryApi.remove(deleting.publicId);
      toast.success('Category deleted');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    {
      key: 'slug',
      label: 'Slug',
      render: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.slug || '—'}</code>,
    },
    { key: 'description', label: 'Description', render: (r) => r.description || '—' },
    { key: 'sortOrder', label: 'Order', align: 'right' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (r.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAdmin(user) && (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleting(r)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Expense categories"
        subtitle="Categories used to classify outtakes"
        actions={isAdmin(user) && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add category
          </Button>
        )}
      />

      <Card pad={false}>
        <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No categories yet." />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit category' : 'Add category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input
            label="Slug"
            hint="URL-friendly name, e.g. road-construction"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <Input
            label="Description"
            className="sm:col-span-2"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Input
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="active"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="active" className="text-sm text-slate-700">
              Active
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete category"
        message={`Delete "${deleting?.name}"? Existing outtakes keep their category; the category will no longer appear in new entries.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}