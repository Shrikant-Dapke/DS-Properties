import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as plotService from '../services/plot.service.js';
import * as paymentService from '../services/payment.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';

const statusBadge = {
  Available: 'bg-navy/5 text-navy',
  Reserved: 'bg-lavender/15 text-lavender',
  Allocated: 'bg-indigo/10 text-indigo',
  Sold: 'bg-mint/15 text-mint',
};

export default function PlotDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plot, setPlot] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    plotService
      .getPlot(id)
      .then(setPlot)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load plot.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    paymentService
      .listPayments({ plot: id, limit: 200 })
      .then((r) => setPayments(r.items))
      .catch(() => {})
      .finally(() => setPaymentsLoading(false));
  }, [id]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await plotService.deletePlot(id);
      navigate('/plots');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete plot.');
      setDeleting(false);
      setPendingDelete(false);
    }
  }

  if (loading) return <p className="font-mono text-sm text-navy/50">Loading…</p>;
  if (error)
    return <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>;

  const rows = [
    ['Plot Number', plot.plotNumber],
    ['Status', plot.status],
    ['Location', plot.location || '—'],
    [
      'Area',
      plot.area !== undefined && plot.area !== null
        ? `${plot.area}${plot.areaUnit ? ` ${plot.areaUnit}` : ''}`
        : '—',
    ],
    ['List Price', plot.price],
    ['Agreement Amount', plot.agreementAmount || '—'],
    ['Notes', plot.notes || '—'],
    ['Created', plot.createdAt ? new Date(plot.createdAt).toLocaleString() : '—'],
    ['Updated', plot.updatedAt ? new Date(plot.updatedAt).toLocaleString() : '—'],
  ];

  return (
    <section className="max-w-xl">
      <Link to="/plots" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Plots
      </Link>
      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy">{plot.plotNumber}</h1>
          <span
            className={`mt-2 inline-block rounded px-2 py-1 font-sans text-xs ${
              statusBadge[plot.status] || 'bg-navy/5 text-navy'
            }`}
          >
            {plot.status}
          </span>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/plots/${plot._id}/edit`}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
          >
            Edit
          </Link>
          <Link
            to={`/payments/new?plot=${plot._id}`}
            className="rounded bg-mint px-4 py-2 font-sans font-medium text-navy hover:bg-mint/90"
          >
            Record Payment
          </Link>
          <button
            onClick={() => setPendingDelete(true)}
            className="rounded bg-orange px-4 py-2 font-sans font-medium text-white hover:bg-orange/90"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4 border-b border-navy/5 pb-3">
              <dt className="w-32 font-mono text-xs uppercase tracking-wider text-navy/50">{label}</dt>
              <dd className="font-sans text-navy">{value}</dd>
            </div>
          ))}
          <div className="flex gap-4 border-b border-navy/5 pb-3">
            <dt className="w-32 font-mono text-xs uppercase tracking-wider text-navy/50">Customer</dt>
            <dd className="font-sans text-navy">
              {plot.customerId ? (
                <Link
                  to={`/customers/${plot.customerId._id}`}
                  className="text-indigo hover:underline"
                >
                  {plot.customerId.name}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </div>

      <h2 className="mt-8 font-display text-2xl text-navy">Payment Summary</h2>
      {paymentsLoading ? (
        <p className="mt-2 font-mono text-sm text-navy/50">Loading…</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-6">
            <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Agreement Amount</p>
              <p className="font-mono text-lg text-navy">
                {plot.agreementAmount !== null && plot.agreementAmount !== undefined
                  ? plot.agreementAmount
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Total Paid</p>
              <p className="font-mono text-lg text-mint">
                {payments.reduce((s, p) => s + Number(p.amount || 0), 0)}
              </p>
            </div>
            <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Outstanding</p>
              <p className="font-mono text-lg text-orange">
                {plot.agreementAmount !== null && plot.agreementAmount !== undefined
                  ? Number(plot.agreementAmount) -
                    payments.reduce((s, p) => s + Number(p.amount || 0), 0)
                  : '—'}
              </p>
            </div>
          </div>

          {plot.agreementAmount === null || plot.agreementAmount === undefined ? (
            <p className="mt-2 font-sans text-navy/60">
              No payment can be recorded until the plot has a customer and an agreement amount.
            </p>
          ) : null}

          <h3 className="mt-6 font-mono text-sm uppercase tracking-wider text-navy/50">Payment History</h3>
          {payments.length === 0 ? (
            <p className="mt-2 font-sans text-navy/60">No payments recorded for this plot.</p>
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
                  {payments.map((p) => (
                    <tr
                      key={p._id}
                      onClick={() => navigate(`/payments/${p._id}`)}
                      className="cursor-pointer border-b border-navy/5 hover:bg-navy/5"
                    >
                      <td className="px-4 py-3 font-mono text-sm text-navy">
                        {p.date ? new Date(p.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-mint">{p.amount}</td>
                      <td className="px-4 py-3 font-sans text-navy/70">{p.method}</td>
                      <td className="px-4 py-3 font-sans text-navy/70">{p.reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <DeleteConfirmModal
        open={pendingDelete}
        name={`Plot ${plot.plotNumber}`}
        busy={deleting}
        onCancel={() => setPendingDelete(false)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
