import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  listChangeRequests,
  createChangeRequest,
  ENTITY_TYPES,
  OPERATIONS,
  STATUS_BADGE,
} from '../services/changeRequest.service.js';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatDateTime } from '../utils/format.js';

const inputClass =
  'mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy outline-none focus:border-indigo focus:ring-1 focus:ring-indigo';

export default function ApprovalsPage() {
  const { isPartner } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listChangeRequests();
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load change requests.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Approvals</h1>
          <p className="font-sans text-sm text-navy/60">
            Partner-initiated changes awaiting multi-approval before they take
            effect.
          </p>
        </div>
        {isPartner && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            New Request
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No change requests yet"
            description="Partner changes to shared records will appear here for approval."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-navy/5 text-navy/60">
              <tr>
                <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                  Operation
                </th>
                <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                  Requested By
                </th>
                <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {items.map((cr) => (
                <tr
                  key={cr._id}
                  className="cursor-pointer hover:bg-navy/5"
                  onClick={() => navigate(`/approvals/${cr._id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-navy">
                      {cr.entityType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy/80">{cr.operation}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_BADGE[cr.status] || 'navy'}>
                      {cr.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-navy/80">
                    {cr.requestedBy?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-navy/60">
                    {formatDateTime(cr.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            toast.success('Change request submitted.');
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const { toast } = useToast();
  const [entityType, setEntityType] = useState(ENTITY_TYPES[0]);
  const [operation, setOperation] = useState('update');
  const [entityId, setEntityId] = useState('');
  const [rows, setRows] = useState([{ field: '', newValue: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  function updateRow(idx, key, value) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );
  }

  async function submit() {
    setFormError('');
    const changes = rows
      .map((r) => ({
        field: r.field.trim(),
        newValue: r.newValue === '' ? null : r.newValue,
      }))
      .filter((c) => c.field);

    if (operation !== 'delete' && changes.length === 0) {
      setFormError('Add at least one field change.');
      return;
    }
    if (operation !== 'create' && !entityId.trim()) {
      setFormError('Entity ID is required for update/delete.');
      return;
    }

    setSubmitting(true);
    try {
      await createChangeRequest({
        entityType,
        operation,
        entityId: operation === 'create' ? null : entityId.trim(),
        changes,
      });
      onCreated();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to create change request.'));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="font-display text-xl text-navy">New Change Request</h2>
        <p className="mb-4 font-sans text-sm text-navy/60">
          Changes are applied only after enough active partners approve.
        </p>

        <div className="space-y-4">
          <Field label="Entity Type" htmlFor="entityType">
            <select
              id="entityType"
              className={inputClass}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Operation" htmlFor="operation">
            <select
              id="operation"
              className={inputClass}
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
            >
              {OPERATIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          {operation !== 'create' && (
            <Field
              label="Entity ID"
              htmlFor="entityId"
              hint="The _id of the record to update or delete."
            >
              <input
                id="entityId"
                className={inputClass}
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
              />
            </Field>
          )}

          {operation !== 'delete' && (
            <div>
              <span className="block font-mono text-xs uppercase tracking-wider text-navy/50">
                Changes
              </span>
              <div className="mt-2 space-y-2">
                {rows.map((r, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="field"
                      value={r.field}
                      onChange={(e) => updateRow(idx, 'field', e.target.value)}
                    />
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="new value"
                      value={r.newValue}
                      onChange={(e) =>
                        updateRow(idx, 'newValue', e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="px-2 text-navy/40 hover:text-orange"
                      onClick={() =>
                        setRows((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() =>
                  setRows((prev) => [...prev, { field: '', newValue: '' }])
                }
              >
                + Add field
              </Button>
            </div>
          )}

          {formError && (
            <p className="text-xs text-orange">{formError}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            Submit Request
          </Button>
        </div>
      </Card>
    </div>
  );
}
