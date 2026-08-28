import { useEffect, useMemo, useState } from 'react';
import { Check, X, Eye, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { changeRequestApi } from '../api/changeRequestApi.js';
import { userApi } from '../api/endpoints.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { Button } from '../components/common/Button.jsx';
import { Card } from '../components/common/Card.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Select } from '../components/common/Select.jsx';
import { Input } from '../components/common/Input.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { formatDateTime } from '../utils/formatters.js';

const STATUS_TONE = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
};

function ProposedChange({ state }) {
  if (!state || typeof state !== 'object' || Object.keys(state).length === 0) {
    return <p className="text-sm text-slate-400">—</p>;
  }
  return (
    <dl className="divide-y divide-slate-100">
      {Object.entries(state).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4 py-1.5">
          <dt className="text-sm text-slate-500">{key}</dt>
          <dd className="text-sm font-medium text-slate-800">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function Approvals() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [userMap, setUserMap] = useState({});
  const [detail, setDetail] = useState(null);
  const [deciding, setDeciding] = useState(null); // { row, decision: 'approve'|'reject' }
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await userApi.list({ limit: 100 });
      const map = {};
      (data.rows || []).forEach((u) => {
        map[u.id] = u.username;
      });
      setUserMap(map);
    } catch {
      // non-fatal; requester names will fall back to ids
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      const data = await changeRequestApi.list(params);
      setRows(data.rows || []);
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const myDecision = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const mine = (r.approvals || []).find((a) => String(a.adminUserId) === String(user?.id));
      map[r.publicId] = mine ? mine.status : null;
    });
    return map;
  }, [rows, user?.id]);

  const isRequiredApprover = (r) =>
    (r.requiredApprovers || []).map(String).includes(String(user?.id));

  const openDecide = (row, decision) => {
    setDeciding({ row, decision });
    setComment('');
  };

  const submitDecision = async () => {
    if (!deciding) return;
    if (deciding.decision === 'reject' && !comment.trim()) {
      toast.error(t('approvals.rejectReason'));
      return;
    }
    setSubmitting(true);
    try {
      if (deciding.decision === 'approve') {
        await changeRequestApi.approve(deciding.row.publicId, comment);
      } else {
        await changeRequestApi.reject(deciding.row.publicId, comment);
      }
      toast.success(deciding.decision === 'approve' ? t('approvals.approve') : t('approvals.reject'));
      setDeciding(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to record decision');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'entityType',
      label: t('approvals.entityType'),
      render: (r) => <span className="font-medium text-slate-800">{t(`entity.${r.entityType}`)}</span>,
    },
    {
      key: 'operation',
      label: t('approvals.operation'),
      render: (r) => <Badge tone="blue">{t(`operation.${r.operation}`)}</Badge>,
    },
    {
      key: 'requester',
      label: t('approvals.requester'),
      render: (r) => userMap[r.requestedBy] || `#${r.requestedBy}`,
    },
    {
      key: 'progress',
      label: t('approvals.progress'),
      render: (r) => {
        const approved = (r.approvals || []).filter((a) => a.status === 'APPROVED').length;
        const required = (r.requiredApprovers || []).length;
        return (
          <span className="text-sm text-slate-600">
            {approved}/{required}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] || 'slate'}>{t(`status.${r.status.toLowerCase()}`)}</Badge>
      ),
    },
    {
      key: 'createdAt',
      label: t('approvals.createdAt'),
      render: (r) => formatDateTime(r.createdAt),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => {
        const decided = myDecision[r.publicId];
        const canDecide = r.status === 'PENDING' && isRequiredApprover(r) && !decided;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
              <Eye className="h-3.5 w-3.5" /> {t('common.details')}
            </Button>
            {canDecide && (
              <>
                <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => openDecide(r, 'approve')}>
                  <Check className="h-3.5 w-3.5" /> {t('approvals.approve')}
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => openDecide(r, 'reject')}>
                  <X className="h-3.5 w-3.5" /> {t('approvals.reject')}
                </Button>
              </>
            )}
            {decided && (
              <span className="text-xs font-medium text-slate-400">{t('approvals.decidedByYou')}</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title={t('approvals.title')} subtitle={t('approvals.subtitle')} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          label={t('approvals.filterStatus')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          <option value="PENDING">{t('status.pending')}</option>
          <option value="APPROVED">{t('status.approved')}</option>
          <option value="REJECTED">{t('status.rejected')}</option>
          <option value="CANCELLED">{t('status.cancelled')}</option>
          <option value="ALL">{t('common.all')}</option>
        </Select>
      </div>

      <Card pad={false}>
        {!loading && rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t('approvals.empty')} />
        ) : (
          <DataTable columns={columns} rows={rows} loading={loading} emptyMessage={t('approvals.empty')} />
        )}
      </Card>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={t('approvals.details')}
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">{t('approvals.entityType')}</p>
                <p className="font-medium text-slate-800">{t(`entity.${detail.entityType}`)}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('approvals.operation')}</p>
                <p className="font-medium text-slate-800">{t(`operation.${detail.operation}`)}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('common.status')}</p>
                <Badge tone={STATUS_TONE[detail.status] || 'slate'}>
                  {t(`status.${detail.status.toLowerCase()}`)}
                </Badge>
              </div>
              <div>
                <p className="text-slate-500">{t('approvals.requester')}</p>
                <p className="font-medium text-slate-800">
                  {userMap[detail.requestedBy] || `#${detail.requestedBy}`}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold text-slate-700">{t('approvals.proposedChange')}</p>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <ProposedChange state={detail.proposedState} />
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold text-slate-700">{t('approvals.progress')}</p>
              <ul className="space-y-1">
                {(detail.approvals || []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{userMap[a.adminUserId] || `#${a.adminUserId}`}</span>
                    <span className="flex items-center gap-2">
                      {a.comment && <span className="text-xs text-slate-400">“{a.comment}”</span>}
                      <Badge tone={a.status === 'APPROVED' ? 'green' : a.status === 'REJECTED' ? 'red' : 'slate'}>
                        {t(`status.${a.status.toLowerCase()}`)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deciding}
        onClose={() => setDeciding(null)}
        onConfirm={submitDecision}
        title={deciding?.decision === 'approve' ? t('approvals.approve') : t('approvals.reject')}
        confirmLabel={deciding?.decision === 'approve' ? t('approvals.approve') : t('approvals.reject')}
        danger={deciding?.decision === 'reject'}
        loading={submitting}
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {deciding?.decision === 'approve' ? t('approvals.allApproved') : t('approvals.rejectReason')}
          </p>
          <Input
            label={t('approvals.approveComment')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required={deciding?.decision === 'reject'}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
