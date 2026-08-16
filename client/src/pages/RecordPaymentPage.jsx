import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as customerService from '../services/customer.service.js';
import * as plotService from '../services/plot.service.js';
import * as paymentService from '../services/payment.service.js';
import Field, { inputClass } from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency } from '../utils/format.js';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
const labelClass = 'block font-mono text-xs uppercase tracking-wider text-navy/50';

export default function RecordPaymentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
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
  const [amountError, setAmountError] = useState('');
  const [plotError, setPlotError] = useState('');
  const [plotsLoading, setPlotsLoading] = useState(false);
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
    setPlotError('');
    if (!customerId) {
      setPlots([]);
      return;
    }
    setPlotsLoading(true);
    plotService
      .listPlots({ customer: customerId, limit: 200 })
      .then((r) => setPlots(r.items))
      .catch(() => setPlots([]))
      .finally(() => setPlotsLoading(false));
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
  const plotPrice =
    plotDetail && plotDetail.price !== null && plotDetail.price !== undefined
      ? Number(plotDetail.price)
      : null;
  const remaining = plotPrice !== null ? plotPrice - paid : null;
  const resulting = amount && remaining !== null ? remaining - Number(amount) : null;

  const canRecord = plotDetail && plotDetail.customerId;

  function validate() {
    if (!plotId) {
      setPlotError('Please select a plot.');
      return false;
    }
    setPlotError('');
    if (!amount || Number(amount) <= 0) {
      setAmountError('Enter an amount greater than zero.');
      return false;
    }
    if (remaining !== null && Number(amount) > remaining) {
      setAmountError('Payment cannot exceed the remaining balance.');
      return false;
    }
    setAmountError('');
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    paymentService
      .createPayment({ customerId, plotId, amount: amount || 0, date, method, reference, notes })
      .then((p) => {
        toast.success('Payment recorded successfully.');
        navigate(`/payments/${p._id}`);
      })
      .catch((err) => {
        setSubmitting(false);
        toast.error(getErrorMessage(err, 'Failed to record payment.'));
      });
  }

  return (
    <section className="max-w-xl">
      <Link to="/payments" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Payments
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Record Payment</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
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

        <Field label="Plot" htmlFor="plotId" required error={plotError}>
          <select
            id="plotId"
            className={inputClass}
            value={plotId}
            onChange={(e) => {
              setPlotId(e.target.value);
              if (plotError) setPlotError('');
            }}
            required
            disabled={!customerId || plotsLoading || plots.length === 0}
          >
            <option value="">
              {!customerId
                ? 'Select a customer first'
                : plotsLoading
                ? 'Loading plots…'
                : 'Select plot…'}
            </option>
            {plots.map((p) => (
              <option key={p._id} value={p._id}>
                {p.plotNumber}
              </option>
            ))}
          </select>
        </Field>

        {customerId && !plotsLoading && plots.length === 0 && (
          <p className="font-sans text-sm text-navy/60">
            No plots available for this customer. Add a plot for this customer first, then record the
            payment.
          </p>
        )}

        {loadingPlot && <p className="font-mono text-sm text-navy/50">Loading plot…</p>}

        {plotDetail && (
          <div className="rounded-lg bg-navy/5 p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-navy/50">Plot financials (read-only)</p>
            <dl className="mt-2 space-y-1 font-mono text-sm text-navy">
              <div className="flex justify-between">
                <dt>Plot Price</dt>
                <dd>{plotPrice !== null ? formatCurrency(plotPrice) : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Paid So Far</dt>
                <dd>{formatCurrency(paid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Remaining</dt>
                <dd className={remaining !== null && remaining > 0 ? 'text-mint' : 'text-orange'}>
                  {remaining !== null ? formatCurrency(remaining) : '—'}
                </dd>
              </div>
            </dl>
            {!canRecord && (
              <p className="mt-2 text-xs text-orange">
                No payment can be recorded until the plot has a customer assigned.
              </p>
            )}
          </div>
        )}

        <Field label="Amount" htmlFor="amount" required error={amountError}>
          <input
            id="amount"
            type="number"
            step="any"
            className={inputClass}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (amountError) setAmountError('');
            }}
            required
          />
        </Field>

        {resulting !== null && (
          <p className="font-mono text-sm text-navy/70">
            Resulting remaining:{' '}
            <span className={resulting >= 0 ? 'text-mint' : 'text-orange'}>
              {resulting !== null ? formatCurrency(resulting) : '—'}
            </span>
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

        <Button type="submit" loading={submitting}>
          {submitting ? 'Recording…' : 'Record Payment'}
        </Button>
      </form>
    </section>
  );
}
