import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as paymentService from '../services/payment.service.js';

export default function PaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    paymentService
      .getPayment(id)
      .then(setPayment)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load payment.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="font-mono text-sm text-navy/50">Loading…</p>;
  if (error)
    return <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>;

  const rows = [
    ['Customer', payment.customerId ? payment.customerId.name : '—'],
    ['Plot', payment.plotId ? payment.plotId.plotNumber : '—'],
    ['Amount', payment.amount],
    ['Date', payment.date ? new Date(payment.date).toLocaleDateString() : '—'],
    ['Method', payment.method],
    ['Reference', payment.reference || '—'],
    ['Notes', payment.notes || '—'],
    ['Created', payment.createdAt ? new Date(payment.createdAt).toLocaleString() : '—'],
  ];

  return (
    <section className="max-w-xl">
      <Link to="/payments" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Payments
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Payment</h1>

      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4 border-b border-navy/5 pb-3">
              <dt className="w-32 font-mono text-xs uppercase tracking-wider text-navy/50">{label}</dt>
              <dd className="font-sans text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 flex gap-3">
        {payment.customerId && (
          <Link
            to={`/customers/${payment.customerId._id}`}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
          >
            View Customer
          </Link>
        )}
        {payment.plotId && (
          <Link
            to={`/plots/${payment.plotId._id}`}
            className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90"
          >
            View Plot
          </Link>
        )}
      </div>
    </section>
  );
}
