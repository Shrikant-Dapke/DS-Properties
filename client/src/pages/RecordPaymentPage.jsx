import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as customerService from '../services/customer.service.js';
import * as plotService from '../services/plot.service.js';
import * as paymentService from '../services/payment.service.js';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
const labelClass = 'block font-mono text-xs uppercase tracking-wider text-navy/50';
const inputClass =
  'mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none';

export default function RecordPaymentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [plots, setPlots] = useState([]);
  const [customerId, setCustomerId] = useState(params.get('customer') || '');
  const [plotId, setPlotId] = useState(params.get('plot') || '');
  const [plotDetail, setPlotDetail] = useState(null);
  const [paymentsForPlot, setPaymentsForPlot] = useState([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingPlot, setLoadingPlot] = useState(false);

  useEffect(() => {
    customerService
      .listCustomers({ limit: 200 })
      .then((r) => setCustomers(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPlotId('');
    setPlotDetail(null);
    setPaymentsForPlot([]);
    if (!customerId) {
      setPlots([]);
      return;
    }
    plotService
      .listPlots({ customer: customerId, limit: 200 })
      .then((r) => setPlots(r.items))
      .catch(() => setPlots([]));
  }, [customerId]);

  useEffect(() => {
    if (!plotId) {
      setPlotDetail(null);
      setPaymentsForPlot([]);
      return;
    }
    setLoadingPlot(true);
    Promise.all([
      plotService.getPlot(plotId),
      paymentService.listPayments({ plot: plotId, limit: 200 }),
    ])
      .then(([plot, pr]) => {
        setPlotDetail(plot);
        setPaymentsForPlot(pr.items);
      })
      .catch(() => {
        setPlotDetail(null);
        setPaymentsForPlot([]);
      })
      .finally(() => setLoadingPlot(false));
  }, [plotId]);

  const paid = paymentsForPlot.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const agreement =
    plotDetail && plotDetail.agreementAmount !== null && plotDetail.agreementAmount !== undefined
      ? Number(plotDetail.agreementAmount)
      : null;
  const remaining = agreement !== null ? agreement - paid : null;
  const resulting = amount && remaining !== null ? remaining - Number(amount) : null;

  const canRecord =
    plotDetail &&
    plotDetail.customerId &&
    plotDetail.agreementAmount !== null &&
    plotDetail.agreementAmount !== undefined;

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    paymentService
      .createPayment({ customerId, plotId, amount: amount || 0, date, method, reference, notes })
      .then((p) => navigate(`/payments/${p._id}`))
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to record payment.');
        setSubmitting(false);
      });
  }

  return (
    <section className="max-w-xl">
      <Link to="/payments" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Payments
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Record Payment</h1>

      {error && (
        <div className="mt-4 rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className={labelClass} htmlFor="customerId">
            Customer
          </label>
          <select
            id="customerId"
            className={inputClass}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="plotId">
            Plot
          </label>
          <select
            id="plotId"
            className={inputClass}
            value={plotId}
            onChange={(e) => setPlotId(e.target.value)}
            required
            disabled={!customerId}
          >
            <option value="">{customerId ? 'Select plot…' : 'Select a customer first'}</option>
            {plots.map((p) => (
              <option key={p._id} value={p._id}>
                {p.plotNumber}
              </option>
            ))}
          </select>
        </div>

        {loadingPlot && <p className="font-mono text-sm text-navy/50">Loading plot…</p>}

        {plotDetail && (
          <div className="rounded-lg bg-navy/5 p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Plot financials (read-only)</p>
            <dl className="mt-2 space-y-1 font-mono text-sm text-navy">
              <div className="flex justify-between">
                <dt>Agreement Amount</dt>
                <dd>{agreement !== null ? agreement : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Paid So Far</dt>
                <dd>{paid}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Remaining</dt>
                <dd className={remaining !== null && remaining > 0 ? 'text-mint' : 'text-orange'}>
                  {remaining !== null ? remaining : '—'}
                </dd>
              </div>
            </dl>
            {!canRecord && (
              <p className="mt-2 text-xs text-orange">
                No payment can be recorded until the plot has a customer and an agreement amount.
              </p>
            )}
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="amount">
            Amount *
          </label>
          <input
            id="amount"
            type="number"
            step="any"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {resulting !== null && (
          <p className="font-mono text-sm text-navy/70">
            Resulting remaining:{' '}
            <span className={resulting >= 0 ? 'text-mint' : 'text-orange'}>{resulting}</span>
          </p>
        )}

        <div>
          <label className={labelClass} htmlFor="date">
            Payment Date *
          </label>
          <input
            id="date"
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="method">
            Method
          </label>
          <select
            id="method"
            className={inputClass}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="reference">
            Reference
          </label>
          <input
            id="reference"
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !canRecord}
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white hover:bg-indigo/90 disabled:opacity-50"
        >
          {submitting ? 'Recording…' : 'Record Payment'}
        </button>
      </form>
    </section>
  );
}
