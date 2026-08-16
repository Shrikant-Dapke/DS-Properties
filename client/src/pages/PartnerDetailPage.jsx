import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as partnerService from '../services/partner.service.js';
import * as capitalService from '../services/capital.service.js';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency, formatDate } from '../utils/format.js';

export default function PartnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState(null);
  const [summary, setSummary] = useState(null);
  const [capital, setCapital] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [p, s, c] = await Promise.all([
        partnerService.getPartner(id),
        partnerService.getPartnerCapitalSummary(id),
        capitalService.listCapital({ partner: id, limit: 200 }),
      ]);
      setPartner(p);
      setSummary(s);
      setCapital(c.items);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load partner.'));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Spinner size="sm" className="mt-6" />;
  if (error) return <ErrorState title="Unable to load partner." message={error} onRetry={load} />;

  const rows = [
    ['Name', partner.name],
    ['Phone', partner.phone || '—'],
    ['Email', partner.email || '—'],
    ['Address', partner.address || '—'],
    ['Notes', partner.notes || '—'],
    ['Created', partner.createdAt ? new Date(partner.createdAt).toLocaleString() : '—'],
  ];

  return (
    <section className="max-w-xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy">{partner.name}</h1>
          <div className="mt-1">
            <Badge color={partner.status === 'Active' ? 'mint' : 'navy'}>{partner.status}</Badge>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/partners/${partner._id}/edit`}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
          >
            Edit
          </Link>
          <Link
            to={`/receipts/new?type=capital&partner=${partner._id}`}
            className="rounded bg-mint px-4 py-2 font-sans font-medium text-navy hover:bg-mint/90"
          >
            Record Capital
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4 border-b border-navy/5 pb-3">
              <dt className="w-28 font-mono text-xs uppercase tracking-wider text-navy/50">{label}</dt>
              <dd className="font-sans text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <h2 className="mt-8 font-display text-2xl text-navy">Funding Summary</h2>
      <div className="mt-3 flex flex-wrap gap-6">
        <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Total Capital Contributed</p>
          <p className="font-mono text-lg text-mint">{formatCurrency(summary.totalContributed)}</p>
        </div>
        <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Contributions</p>
          <p className="font-mono text-lg text-navy">{summary.contributionCount}</p>
        </div>
        <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Not Revenue</p>
          <p className="font-mono text-lg text-orange">Business funding</p>
        </div>
      </div>

      <h2 className="mt-8 font-display text-2xl text-navy">Capital Contribution History</h2>
      {capital.length === 0 ? (
        <p className="mt-2 font-sans text-navy/60">No capital contributions recorded for this partner.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody>
              {capital.map((c) => (
                <tr
                  key={c._id}
                  onClick={() => navigate(`/receipts?type=capital`)}
                  className="cursor-pointer border-b border-navy/5 hover:bg-navy/5"
                >
                  <td className="px-4 py-3 font-mono text-sm text-navy">{formatDate(c.date)}</td>
                  <td className="px-4 py-3 font-mono text-sm text-mint">{formatCurrency(c.amount)}</td>
                  <td className="px-4 py-3 font-sans text-navy/70">{c.method}</td>
                  <td className="px-4 py-3 font-sans text-navy/70">{c.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
