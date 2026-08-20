import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Select } from '../components/common/Select.jsx';
import { Card } from '../components/common/Card.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { DateRangeFilter } from '../components/common/DateRangeFilter.jsx';
import { formatINR, formatDate, formatDateTime, titleCase } from '../utils/formatters.js';
import { canWrite, isAdmin } from '../contexts/authContextDef.js';
import { SOURCE_LABELS, TRANSACTION_TYPES } from '../utils/constants.js';
import { DATE_MODES } from '../utils/dateRange.js';

const filtersInitial = {
  type: '',
  sourceType: '',
  q: '',
  from: '',
  to: '',
};

export default function Transactions() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(filtersInitial);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [rangeResetKey, setRangeResetKey] = useState(0);

  const load = async (p = page, f = filters) => {
    setLoading(true);
    try {
      const params = {
        page: p,
        limit: 20,
        type: f.type || undefined,
        sourceType: f.sourceType || undefined,
        search: f.q || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
      };
      const data = await transactionApi.list(params);
      setRows(data.rows || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, filters);
  };

  // Quick-mode range changes apply immediately and reset to the first page.
  const applyRange = (range) => {
    setFilters((f) => ({ ...f, from: range.from, to: range.to }));
    setPage(1);
    load(1, { ...filters, from: range.from, to: range.to });
  };

  const resetFilters = () => {
    setFilters(filtersInitial);
    setPage(1);
    setRangeResetKey((k) => k + 1);
    load(1, filtersInitial);
  };

  const runAction = async () => {
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await transactionApi.remove(selected.publicId, { adminPassword });
        toast.success('Transaction deleted');
      } else if (action === 'reverse') {
        await transactionApi.reverse(selected.publicId, { adminPassword, reason: 'Reversed from web UI' });
        toast.success('Transaction reversed');
      }
      setAction(null);
      setAdminPassword('');
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      key: 'transactionDate',
      label: 'Date',
      render: (r) => formatDate(r.transactionDate),
    },
    {
      key: 'transactionType',
      label: 'Type',
      render: (r) =>
        r.isReversal ? (
          <Badge tone="amber">Reversal</Badge>
        ) : r.transactionType === TRANSACTION_TYPES.INTAKE ? (
          <Badge tone="green">Intake</Badge>
        ) : (
          <Badge tone="red">Outtake</Badge>
        ),
    },
    {
      key: 'sourceType',
      label: 'Source',
      render: (r) => SOURCE_LABELS[r.sourceType] || titleCase(r.sourceType) || '—',
    },
    { key: 'description', label: 'Description', render: (r) => r.description || r.paidTo || r.customer?.name || r.partner?.name || '—' },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (r) => (
        <span className={`font-semibold ${r.transactionType === 'intake' ? 'text-emerald-700' : 'text-red-600'}`}>
          {r.transactionType === 'intake' ? '+' : '−'}{formatINR(r.amount)}
        </span>
      ),
    },
    {
      key: 'paymentMode',
      label: 'Mode',
      render: (r) => titleCase(r.paymentMode),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (r) => formatDateTime(r.createdAt),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="All intakes and outtakes"
        actions={canWrite(user) && <Button onClick={() => navigate('/entries/new')}>+ Add Entry</Button>}
      />

      <Card className="mb-4" pad={false}>
        <form onSubmit={applyFilters} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Input label="Search" placeholder="Description / ref / plot" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <Select label="Type" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
            <option value="">All</option>
            <option value="intake">Intake</option>
            <option value="outtake">Outtake</option>
          </Select>
          <Select label="Source" value={filters.sourceType} onChange={(e) => setFilters((f) => ({ ...f, sourceType: e.target.value }))}>
            <option value="">All</option>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2 lg:col-span-3">
            <DateRangeFilter
              key={rangeResetKey}
              defaultMode={DATE_MODES.CUSTOM}
              allowEmpty
              onChange={applyRange}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">Filter</Button>
            <Button type="button" variant="ghost" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </form>
      </Card>

      <Card pad={false}>
        <DataTable columns={columns} rows={rows} loading={loading} onRowClick={setSelected} emptyMessage="Try adjusting the filters." />
        <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); load(p); }} />
      </Card>

      {selected && (
        <Modal
          open={!!selected}
          onClose={() => setSelected(null)}
          title="Transaction details"
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
              {canWrite(user) && !selected.isReversal && !selected.reversedAt && (
                <Button variant="secondary" onClick={() => navigate(`/entries/new?edit=${selected.publicId}`)}>
                  Edit
                </Button>
              )}
              {isAdmin(user) && !selected.isReversal && !selected.reversedAt && (
                <>
                  <Button variant="secondary" onClick={() => setAction('reverse')}>
                    Reverse
                  </Button>
                  <Button variant="danger" onClick={() => setAction('delete')}>
                    Delete
                  </Button>
                </>
              )}
            </>
          }
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Date</dt>
              <dd className="font-medium">{formatDate(selected.transactionDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Amount</dt>
              <dd className="font-bold text-slate-800">{formatINR(selected.amount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Type</dt>
              <dd className="font-medium">{titleCase(selected.transactionType)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Source</dt>
              <dd className="font-medium">{SOURCE_LABELS[selected.sourceType] || titleCase(selected.sourceType) || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Payment mode</dt>
              <dd className="font-medium">{titleCase(selected.paymentMode)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Reference</dt>
              <dd className="font-medium">{selected.referenceNumber || '—'}</dd>
            </div>
            {selected.plotNumber && (
              <div>
                <dt className="text-xs text-slate-500">Plot</dt>
                <dd className="font-medium">{selected.plotNumber}</dd>
              </div>
            )}
            {selected.paidTo && (
              <div>
                <dt className="text-xs text-slate-500">Paid to</dt>
                <dd className="font-medium">{selected.paidTo}</dd>
              </div>
            )}
            {selected.customer && (
              <div>
                <dt className="text-xs text-slate-500">Customer</dt>
                <dd className="font-medium">{selected.customer.name}</dd>
              </div>
            )}
            {selected.partner && (
              <div>
                <dt className="text-xs text-slate-500">Partner</dt>
                <dd className="font-medium">{selected.partner.name}</dd>
              </div>
            )}
            {selected.category && (
              <div>
                <dt className="text-xs text-slate-500">Category</dt>
                <dd className="font-medium">{selected.category.name}</dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">Description</dt>
              <dd className="font-medium">{selected.description || '—'}</dd>
            </div>
            {selected.reversalReason && (
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Reversal reason</dt>
                <dd className="font-medium text-amber-700">{selected.reversalReason}</dd>
              </div>
            )}
            {selected.reversedAt && (
              <div>
                <dt className="text-xs text-slate-500">Reversed at</dt>
                <dd className="font-medium text-amber-700">{formatDateTime(selected.reversedAt)}</dd>
              </div>
            )}
            {selected.createdBy && (
              <div>
                <dt className="text-xs text-slate-500">Created by</dt>
                <dd className="font-medium">{selected.createdBy.username}</dd>
              </div>
            )}
          </dl>
        </Modal>
      )}

      {(action === 'delete' || action === 'reverse') && (
        <Modal
          open={!!action}
          onClose={() => { setAction(null); setAdminPassword(''); }}
          title={action === 'delete' ? 'Delete transaction' : 'Reverse transaction'}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setAction(null); setAdminPassword(''); }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={runAction} loading={actionLoading}>
                {action === 'delete' ? 'Delete' : 'Reverse'}
              </Button>
            </>
          }
        >
          <p className="mb-4 text-sm text-slate-600">
            {action === 'delete'
              ? 'Deleting removes this entry from all totals. This action is audited and cannot be undone.'
              : 'Reversing marks the original entry as reversed and creates an offsetting record. This is audited.'}
          </p>
          <Input
            label="Admin password (re-entry required)"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            autoComplete="off"
            required
            autoFocus
          />
        </Modal>
      )}
    </div>
  );
}