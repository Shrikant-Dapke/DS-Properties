import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as customerService from '../services/customer.service.js';
import * as plotService from '../services/plot.service.js';
import * as paymentService from '../services/payment.service.js';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency } from '../utils/format.js';

const statusBadge = {
  Available: 'navy',
  Reserved: 'lavender',
  Allocated: 'indigo',
  Sold: 'mint',
};

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [plots, setPlots] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plotsLoading, setPlotsLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError('');
    await customerService
      .getCustomer(id)
      .then(setCustomer)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load customer.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    plotService
      .listPlots({ customer: id, limit: 200 })
      .then((r) => setPlots(r.items))
      .catch(() => {})
      .finally(() => setPlotsLoading(false));
  }, [id]);

  useEffect(() => {
    paymentService
      .listPayments({ customer: id, limit: 200 })
      .then((r) => setPayments(r.items))
      .catch(() => {})
      .finally(() => setPaymentsLoading(false));
  }, [id]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await customerService.deleteCustomer(id);
      toast.success('Customer deleted successfully.');
      navigate('/customers');
    } catch (err) {
      setPendingDelete(false);
      setDeleting(false);
      toast.error(getErrorMessage(err, 'Failed to delete customer.'));
    }
  }

  if (loading) return <Spinner size="sm" className="mt-6" />;
  if (error)
    return <ErrorState title="Unable to load customer." message={error} onRetry={load} />;

  const rows = [
    ['Name', customer.name],
    ['Phone', customer.phone || '—'],
    ['Email', customer.email || '—'],
    ['Address', customer.address || '—'],
    ['Notes', customer.notes || '—'],
    ['Created', customer.createdAt ? new Date(customer.createdAt).toLocaleString() : '—'],
  ];

  return (
    <section className="max-w-xl">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-3xl text-navy">{customer.name}</h1>
        <div className="flex gap-3">
          <Link
            to={`/customers/${customer._id}/edit`}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
          >
            Edit
          </Link>
          <Link
            to={`/payments/new?customer=${customer._id}`}
            className="rounded bg-mint px-4 py-2 font-sans font-medium text-navy hover:bg-mint/90"
          >
            Record Payment
          </Link>
          <Button variant="danger" onClick={() => setPendingDelete(true)}>
            Delete
          </Button>
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
        <p className="mt-4 font-mono text-xs text-navy/40">Plot associations arrive in the next phase.</p>
      </div>

      <h2 className="mt-8 font-display text-2xl text-navy">Payment History</h2>
      {paymentsLoading ? (
        <Spinner size="sm" className="mt-2" />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-6">
            <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Total Payments Received</p>
              <p className="font-mono text-lg text-mint">
                {formatCurrency(payments.reduce((s, p) => s + Number(p.amount || 0), 0))}
              </p>
            </div>
            <div className="rounded-lg bg-white px-5 py-3 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Outstanding Receivables</p>
              <p className="font-mono text-lg text-orange">
                {formatCurrency(
                  (() => {
                    const paidByPlot = {};
                    payments.forEach((p) => {
                      const key = p.plotId?._id || p.plotId;
                      paidByPlot[key] = (paidByPlot[key] || 0) + Number(p.amount || 0);
                    });
                    return plots.reduce((sum, plot) => {
                      if (!plot.customerId) return sum;
                      const paid = paidByPlot[plot._id] || 0;
                      return sum + Math.max(0, Number(plot.price || 0) - paid);
                    }, 0);
                  })()
                )}
              </p>
            </div>
          </div>

          {payments.length === 0 ? (
            <p className="mt-2 font-sans text-navy/60">No payments recorded for this customer.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg bg-white shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Plot</th>
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
                      <td className="px-4 py-3 font-sans text-navy">
                        {p.plotId?.plotNumber || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-mint">{formatCurrency(p.amount)}</td>
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

      <h2 className="mt-8 font-display text-2xl text-navy">Associated Plots</h2>
      {plotsLoading ? (
        <Spinner size="sm" className="mt-2" />
      ) : plots.length === 0 ? (
        <p className="mt-2 font-sans text-navy/60">No plots assigned to this customer.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                <th className="px-4 py-3">Plot #</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {plots.map((p) => (
                <tr
                  key={p._id}
                  onClick={() => navigate(`/plots/${p._id}`)}
                  className="cursor-pointer border-b border-navy/5 hover:bg-navy/5"
                >
                  <td className="px-4 py-3 font-sans font-medium text-navy">{p.plotNumber}</td>
                  <td className="px-4 py-3">
                    <Badge color={statusBadge[p.status] || 'navy'}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmModal
        open={pendingDelete}
        name={customer.name}
        busy={deleting}
        onCancel={() => setPendingDelete(false)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
