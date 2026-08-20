import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { partnerApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { Card } from '../components/common/Card.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { formatINR, formatDate } from '../utils/formatters.js';
import { TRANSACTION_TYPES } from '../utils/constants.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';

export default function PartnerDetail() {
  const { publicId } = useParams();
  const toast = useToast();
  const [partner, setPartner] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([partnerApi.get(publicId), partnerApi.ledger(publicId, { page: 1, limit: 15 })])
      .then(([p, ledger]) => {
        if (!active) return;
        setPartner(p);
        setRows(ledger.rows || []);
        setTotalPages(ledger.pagination?.totalPages || 1);
      })
      .catch(() => toast.error('Failed to load partner'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [publicId, toast]);

  const loadLedger = async (p) => {
    try {
      const ledger = await partnerApi.ledger(publicId, { page: p, limit: 15 });
      setRows(ledger.rows || []);
      setTotalPages(ledger.pagination?.totalPages || 1);
      setPage(p);
    } catch {
      toast.error('Failed to load ledger');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!partner) return <p className="text-sm text-slate-500">Partner not found.</p>;

  const columns = [
    { key: 'transaction_date', label: 'Date', render: (r) => formatDate(r.transaction_date) },
    {
      key: 'type',
      label: 'Type',
      render: (r) =>
        r.is_reversal ? (
          <Badge tone="amber">Reversal</Badge>
        ) : r.transaction_type === TRANSACTION_TYPES.INTAKE ? (
          <Badge tone="green">Intake</Badge>
        ) : (
          <Badge tone="red">Outtake</Badge>
        ),
    },
    {
      key: 'source_type',
      label: 'Source',
      render: (r) =>
        r.source_type === 'partner_capital' ? 'Capital' : r.source_type === 'partner_loan' ? 'Loan' : r.source_type,
    },
    { key: 'description', label: 'Description', render: (r) => r.description || r.reference_number || '—' },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (r) => (
        <span className={`font-semibold ${r.transaction_type === 'intake' ? 'text-emerald-700' : 'text-red-600'}`}>
          {r.transaction_type === 'intake' ? '+' : '−'}{formatINR(r.amount)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <Link to="/partners" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to partners
      </Link>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{partner.name}</h1>
            <p className="text-sm text-slate-500">
              {[partner.phone, partner.email, partner.address].filter(Boolean).join(' · ') || 'No contact info'}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-slate-500">Total inflow</p>
              <p className="text-lg font-bold text-slate-800">{formatINR(partner.totalInflow)}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Ledger" subtitle="This partner's transactions" pad={false}>
        <DataTable columns={columns} rows={rows} emptyMessage="No transactions yet." />
        <Pagination page={page} totalPages={totalPages} onPageChange={loadLedger} />
      </Card>
    </div>
  );
}