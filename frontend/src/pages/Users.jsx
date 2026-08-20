import { useEffect, useState } from 'react';
import { Plus, Pencil, KeyRound, Trash2 } from 'lucide-react';
import { userApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Select } from '../components/common/Select.jsx';
import { Card } from '../components/common/Card.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { formatDateTime } from '../utils/formatters.js';
import { ROLES, ROLE_LABELS } from '../utils/constants.js';

const emptyForm = { username: '', fullName: '', role: ROLES.VIEWER, password: '' };

export default function Users() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await userApi.list({ limit: 100 });
      setRows(data.rows || []);
    } catch {
      toast.error('Failed to load users');
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
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ username: row.username, fullName: row.fullName || '', role: row.role, password: '' });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.username.trim()) {
      toast.error('Username is required');
      return;
    }
    setSaving(true);
    try {
      if (!editing) {
        if (!form.password) {
          toast.error('Password is required for new users');
          setSaving(false);
          return;
        }
        if (!form.fullName.trim()) {
          toast.error('Full name is required');
          setSaving(false);
          return;
        }
        await userApi.create({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: form.role,
        });
        toast.success('User created');
      } else {
        await userApi.update(editing.publicId, {
          fullName: form.fullName.trim() || undefined,
          role: form.role,
        });
        toast.success('User updated');
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await userApi.setActive(row.publicId, !row.isActive);
      toast.success(row.isActive ? 'User deactivated' : 'User activated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    }
  };

  const doReset = async () => {
    if (!newPassword) {
      toast.error('Enter a new password');
      return;
    }
    setSaving(true);
    try {
      await userApi.resetPassword(resetting.publicId, newPassword);
      toast.success('Password reset');
      setResetting(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await userApi.remove(deleting.publicId);
      toast.success('User deleted');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const columns = [
    {
      key: 'username',
      label: 'User',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.username}</p>
          {r.fullName && <p className="text-xs text-slate-500">{r.fullName}</p>}
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (r) => (
        <Badge tone={r.role === 'admin' ? 'indigo' : r.role === 'operator' ? 'blue' : 'slate'}>
          {ROLE_LABELS[r.role]}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (r.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>),
    },
    { key: 'lastLoginAt', label: 'Last login', render: (r) => (r.lastLoginAt ? formatDateTime(r.lastLoginAt) : 'Never') },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setResetting(r); setNewPassword(''); }}>
            <KeyRound className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleActive(r)}>
            {r.isActive ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleting(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage system access"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />

      <Card pad={false}>
        <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No users yet." />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.username}` : 'Add user'}
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
          <Input
            label="Username *"
            value={form.username}
            disabled={!!editing}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required
          />
          <Input label="Full name *" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required />
          <Select label="Role *" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          {!editing && (
            <Input
              label="Password *"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              hint="Min 8 characters"
            />
          )}
        </div>
      </Modal>

      <Modal
        open={!!resetting}
        onClose={() => setResetting(null)}
        title={`Reset password · ${resetting?.username}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetting(null)}>
              Cancel
            </Button>
            <Button onClick={doReset} loading={saving}>
              Reset password
            </Button>
          </>
        }
      >
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint="Min 8 characters. The user will log in with this on their next attempt."
          autoFocus
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete user"
        message={`Delete user "${deleting?.username}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}