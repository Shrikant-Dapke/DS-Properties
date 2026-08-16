import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as capitalService from '../services/capital.service.js';
import * as loanService from '../services/loan.service.js';
import * as partnerService from '../services/partner.service.js';
import Field, { inputClass } from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

export default function RecordReceiptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const initialType = searchParams.get('type') === 'loan' ? 'loan' : 'capital';
  const initialPartner = searchParams.get('partner') || '';

  const [type, setType] = useState(initialType);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState(initialPartner);
  const [lender, setLender] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [partnerError, setPartnerError] = useState('');

  useEffect(() => {
    partnerService.listPartners({ limit: 200 }).then((r) => setPartners(r.items || [])).catch(() => {});
  }, []);

  function switchType(value) {
    setType(value);
    setPartnerError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    let valid = true;
    if (!amount || Number(amount) <= 0) {
      setAmountError('Enter an amount greater than zero.');
      valid = false;
    } else {
      setAmountError('');
    }
    if (type === 'capital' && !partnerId) {
      setPartnerError('Select a partner.');
      valid = false;
    } else {
      setPartnerError('');
    }
    if (type === 'loan' && !lender.trim()) {
      setPartnerError('Lender / source is required.');
      valid = false;
    } else if (type === 'loan') {
      setPartnerError('');
    }
    if (!valid) return;

    setSubmitting(true);
    const payload = {
      amount: amount || 0,
      date,
      method,
      reference: reference.trim(),
      notes: notes.trim(),
    };
    if (type === 'capital') payload.partnerId = partnerId;
    else payload.lender = lender.trim();

    const call = type === 'capital' ? capitalService.createCapital(payload) : loanService.createLoan(payload);
    call
      .then(() => {
        toast.success(type === 'capital' ? 'Capital contribution recorded.' : 'Loan received recorded.');
        navigate(`/receipts?type=${type}`);
      })
      .catch((err) => {
        setSubmitting(false);
        toast.error(getErrorMessage(err, 'Failed to record receipt.'));
      });
  }

  return (
    <section className="max-w-xl">
      <Link to="/receipts" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Receipts
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Record Receipt</h1>
      <p className="mt-1 font-sans text-sm text-navy/60">
        Record business funding. Capital contributions and loans are tracked separately from customer
        payments and revenue.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => switchType('capital')}
          aria-pressed={type === 'capital'}
          className={`rounded-full px-3 py-1.5 font-sans text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 ${
            type === 'capital' ? 'bg-indigo text-white shadow-sm' : 'bg-white text-navy hover:bg-indigo/10'
          }`}
        >
          Partner Capital
        </button>
        <button
          type="button"
          onClick={() => switchType('loan')}
          aria-pressed={type === 'loan'}
          className={`rounded-full px-3 py-1.5 font-sans text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 ${
            type === 'loan' ? 'bg-indigo text-white shadow-sm' : 'bg-white text-navy hover:bg-indigo/10'
          }`}
        >
          Loan Received
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {type === 'capital' ? (
          <Field label="Partner" htmlFor="partnerId" required error={partnerError}>
            <select
              id="partnerId"
              className={inputClass}
              value={partnerId}
              onChange={(e) => {
                setPartnerId(e.target.value);
                if (partnerError) setPartnerError('');
              }}
            >
              <option value="">Select partner…</option>
              {partners.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Lender / Source" htmlFor="lender" required error={partnerError}>
            <input
              id="lender"
              className={inputClass}
              value={lender}
              onChange={(e) => {
                setLender(e.target.value);
                if (partnerError) setPartnerError('');
              }}
              placeholder="e.g. ABC Bank, Personal funds"
            />
          </Field>
        )}

        <Field label="Amount (₹)" htmlFor="amount" required error={amountError}>
          <input
            id="amount"
            type="number"
            step="any"
            min="0"
            className={inputClass}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (amountError) setAmountError('');
            }}
            required
          />
        </Field>

        <Field label="Date" htmlFor="date" required>
          <input
            id="date"
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>

        <Field label="Method" htmlFor="method">
          <select id="method" className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reference" htmlFor="reference">
          <input
            id="reference"
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. TXN-001"
          />
        </Field>

        <Field label="Notes" htmlFor="notes">
          <textarea id="notes" rows={3} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/receipts" className="rounded border border-navy/20 px-4 py-2 font-sans text-navy hover:bg-navy/5">
            Cancel
          </Link>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving…' : 'Record Receipt'}
          </Button>
        </div>
      </form>
    </section>
  );
}
