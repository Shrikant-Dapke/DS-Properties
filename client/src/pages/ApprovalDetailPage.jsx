import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
  cancelChangeRequest,
  resubmitChangeRequest,
  STATUS_BADGE,
} from '../services/changeRequest.service.js';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatDateTime } from '../utils/format.js';

function display(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function ApprovalDetailPage() {
  const { id } = useParams();
  const { user, isPartner, isDeveloper } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [cr, setCr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const myId = user?._id?.toString();

  async function load() {
    setLoading(true);
    try {
      const data = await getChangeRequest(id);
      setCr(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load change request.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function run(action, fn) {
    setBusy(true);
    try {
      const updated = await fn();
      setCr(updated);
      setRejectOpen(false);
      setReason('');
      toast.success('Updated.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !cr) {
    return <ErrorState message={error || 'Not found.'} onRetry={load} />;
  }

  const isRequester = cr.requestedBy?._id?.toString() === myId;
  const isApprover = (cr.requiredApprovers || [])
    .map(String)
    .includes(myId);
  const canApprove =
    isPartner && cr.status === 'PENDING' && isApprover && !isRequester;
  const canCancel =
    (isRequester || isDeveloper) && cr.status === 'PENDING';
  const canResubmit = isRequester && cr.status === 'REJECTED';

  return (
    <div className="space-y-6">
      <Link
        to="/approvals"
        className="font-sans text-sm text-indigo hover:underline"
      >
        ← Back to approvals
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">
            {cr.entityType} · {cr.operation}
          </h1>
          <p className="font-sans text-sm text-navy/60">
            Requested by {cr.requestedBy?.name || '—'} on{' '}
            {formatDateTime(cr.requestedAt || cr.createdAt)}
          </p>
        </div>
        <Badge color={STATUS_BADGE[cr.status] || 'navy'}>{cr.status}</Badge>
      </div>

      <Card className="p-6">
        <h2 className="mb-3 font-display text-lg text-navy">Proposed Changes</h2>
        {cr.changes.length === 0 ? (
          <p className="font-sans text-sm text-navy/60">
            No field changes (delete request).
          </p>
        ) : (
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-navy/5 text-navy/60">
              <tr>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider">
                  Field
                </th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider">
                  Current
                </th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider">
                  Proposed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {cr.changes.map((c, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-medium text-navy">
                    {c.field}
                  </td>
                  <td className="px-4 py-2 text-navy/70">
                    {display(c.oldValue)}
                  </td>
                  <td className="px-4 py-2 text-indigo">
                    {display(c.newValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 font-display text-lg text-navy">Approvals</h2>
        <ul className="space-y-2 font-sans text-sm">
          {cr.approvals.map((a, i) => (
            <li
              key={i}
              className="flex items-center justify-between border-b border-navy/10 pb-2 last:border-0"
            >
              <span className="text-navy">
                {a.partnerId?.name || 'Requester'}
                <span className="ml-2 text-navy/50">
                  {formatDateTime(a.at)}
                </span>
              </span>
              <Badge
                color={
                  a.action === 'approved'
                    ? 'mint'
                    : a.action === 'rejected'
                    ? 'orange'
                    : 'navy'
                }
              >
                {a.action}
                {a.note ? `: ${a.note}` : ''}
              </Badge>
            </li>
          ))}
        </ul>
        {cr.status === 'REJECTED' && cr.rejectionReason && (
          <p className="mt-3 font-sans text-sm text-orange">
            Reason: {cr.rejectionReason}
          </p>
        )}
        {cr.status === 'COMMITTED' && (
          <p className="mt-3 font-sans text-sm text-navy/60">
            Committed at {formatDateTime(cr.committedAt)}.
          </p>
        )}
      </Card>

      {(canApprove || canCancel || canResubmit) && (
        <div className="flex flex-wrap items-center gap-3">
          {canApprove && (
            <>
              <Button
                variant="success"
                loading={busy}
                onClick={() =>
                  run('approve', () => approveChangeRequest(cr._id))
                }
              >
                Approve
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            </>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              loading={busy}
              onClick={() => run('cancel', () => cancelChangeRequest(cr._id))}
            >
              Cancel Request
            </Button>
          )}
          {canResubmit && (
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                run('resubmit', () => resubmitChangeRequest(cr._id))
              }
            >
              Resubmit
            </Button>
          )}
        </div>
      )}

      {rejectOpen && (
        <Card className="p-6">
          <h2 className="mb-3 font-display text-lg text-navy">
            Rejection Reason
          </h2>
          <textarea
            className="mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy outline-none focus:border-indigo focus:ring-1 focus:ring-indigo"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this change being rejected?"
          />
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!reason.trim()}
              onClick={() =>
                run('reject', () =>
                  rejectChangeRequest(cr._id, reason.trim())
                )
              }
            >
              Confirm Rejection
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
