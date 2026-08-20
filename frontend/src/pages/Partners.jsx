import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { partnerApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Card } from '../components/common/Card.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { formatINR, formatDate } from '../utils/formatters.js';
import { canWrite, isAdmin } from '../contexts/authContextDef.js';

const empty = { name: '', phone: '', email: '', address: '', notes: '', isActive: true };

export default function Partners() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async (p = page, search = q) => {
    setLoading(true);
    try {
      const data = await partnerApi.list({ page: p, limit: 15, search: search || undefined });
      setRows(data.rows || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error('Failed to load partners');
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
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      notes: row.notes || '',
      isActive: row.isActive,
    });
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined };
      if (editing) {
        await partnerApi.update(editing.publicId, payload);
        toast.success('Partner updated');
      } else {
        delete payload.isActive;
        await partnerApi.create(payload);
        toast.success('Partner added');
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
      await partnerApi.remove(deleting.publicId);
      toast.success('Partner deleted');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.name}</p>
          {r.email && <p className="text-xs text-slate-500">{r.email}</p>}
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    {
      key: 'totalInflow',
      label: 'Total inflow',
      align: 'right',
      render: (r) => <span className="font-semibold text-slate-800">{formatINR(r.totalInflow)}</span>,
    },
    {
      key: 'createdAt',
      label: 'Since',
      render: (r) => formatDate(r.createdAt),
    },
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
          {canWrite(user) && (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {isAdmin(user) && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleting(r)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Partners"
        subtitle="Capital contributors and loan sources"
        actions={canWrite(user) && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add partner
          </Button>
        )}
      />

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search by name, phone or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              load(1, q);
            }
          }}
          className="max-w-xs"
        />
        <Button variant="secondary" onClick={() => { setPage(1); load(1, q); }}>
          Search
        </Button>
      </div>

      <Card pad={false}>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          onRowClick={(r) => navigate(`/partners/${r.publicId}`)}
          emptyMessage="No partners found."
        />
        <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); load(p); }} />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit partner' : 'Add partner'}
        wide
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
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <Input label="Notes" className="sm:col-span-2" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2">
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
        {editing && isAdmin(user) && (
          <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
            <Button variant="ghost" className="text-red-600" onClick={() => { setFormOpen(false); setDeleting(editing); }}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete partner"
        message={`Delete "${deleting?.name}"? This will remove the partner and all their transactions from totals.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}