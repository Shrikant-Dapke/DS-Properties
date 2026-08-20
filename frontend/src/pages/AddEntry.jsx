import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
import { customerApi, partnerApi, categoryApi, transactionApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Select } from '../components/common/Select.jsx';
import { Card } from '../components/common/Card.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import {
  PAYMENT_MODES,
  SOURCE_TYPES,
  SOURCE_LABELS,
  TRANSACTION_TYPES,
  DATE_TODAY,
} from '../utils/constants.js';

const emptyForm = {
  transactionType: TRANSACTION_TYPES.INTAKE,
  sourceType: SOURCE_TYPES.CUSTOMER,
  customerPublicId: '',
  partnerPublicId: '',
  amount: '',
  paymentMode: 'cash',
  transactionDate: DATE_TODAY(),
  referenceNumber: '',
  plotNumber: '',
  paidTo: '',
  description: '',
  expenseCategoryId: '',
};

export default function AddEntry() {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState('');

  const isOuttake = form.transactionType === TRANSACTION_TYPES.OUTTAKE;
  const isCustomer = form.sourceType === SOURCE_TYPES.CUSTOMER;
  const needsPartner = [SOURCE_TYPES.PARTNER_CAPITAL, SOURCE_TYPES.PARTNER_LOAN].includes(form.sourceType);

  useEffect(() => {
    Promise.all([customerApi.list({ limit: 500 }), partnerApi.list({ limit: 500, activeOnly: true }), categoryApi.active()])
      .then(([c, p, cat]) => {
        setCustomers(c.rows || []);
        setPartners(p.rows || []);
        setCategories(cat || []);
      })
      .catch(() => toast.error('Could not load options'));
  }, [toast]);

  const activeCustomers = useMemo(() => customers, [customers]);
  const activePartners = useMemo(() => partners, [partners]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value, warning: '' }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setWarning('');
    setLoading(true);
    try {
      const payload = {
        transactionType: form.transactionType,
        sourceType: form.sourceType,
        amount: Number(form.amount),
        paymentMode: form.paymentMode,
        transactionDate: form.transactionDate,
        referenceNumber: form.referenceNumber || undefined,
        plotNumber: form.plotNumber || undefined,
        paidTo: form.paidTo || undefined,
        description: form.description || undefined,
      };
      if (isCustomer) payload.customerPublicId = form.customerPublicId;
      if (needsPartner) payload.partnerPublicId = form.partnerPublicId;
      if (isOuttake) payload.categoryPublicId = form.expenseCategoryId || undefined;

      const result = await transactionApi.create(payload);
      if (result.duplicateWarning) {
        const n = result.duplicates?.length || 0;
        setWarning(`A similar entry was already recorded in the last 15 minutes (${n} possible duplicate${n === 1 ? '' : 's'}). You may review it in Transactions.`);
      }
      toast.success(isOuttake ? 'Outtake recorded' : 'Intake recorded');
      navigate('/transactions');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add Entry" subtitle="Record an intake or outtake" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, transactionType: TRANSACTION_TYPES.INTAKE }))}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                !isOuttake ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ArrowDownLeft className="h-4 w-4" /> Intake
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, transactionType: TRANSACTION_TYPES.OUTTAKE }))}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                isOuttake ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" /> Outtake
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Source" id="sourceType" value={form.sourceType} onChange={set('sourceType')}>
              <option value={SOURCE_TYPES.CUSTOMER}>{SOURCE_LABELS.customer}</option>
              <option value={SOURCE_TYPES.PARTNER_CAPITAL}>{SOURCE_LABELS.partner_capital}</option>
              <option value={SOURCE_TYPES.PARTNER_LOAN}>{SOURCE_LABELS.partner_loan}</option>
            </Select>

            {isCustomer ? (
              <Select label="Customer" id="customerPublicId" value={form.customerPublicId} onChange={set('customerPublicId')} required>
                <option value="">Select customer…</option>
                {activeCustomers.map((c) => (
                  <option key={c.publicId} value={c.publicId}>
                    {c.name}
                    {c.phone ? ` — ${c.phone}` : ''}
                  </option>
                ))}
              </Select>
            ) : (
              <Select label="Partner" id="partnerPublicId" value={form.partnerPublicId} onChange={set('partnerPublicId')} required>
                <option value="">Select partner…</option>
                {activePartners.map((p) => (
                  <option key={p.publicId} value={p.publicId}>
                    {p.name}
                    {p.phone ? ` — ${p.phone}` : ''}
                  </option>
                ))}
              </Select>
            )}

            <Input label="Amount (₹)" id="amount" type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" required />

            <Select label="Payment mode" id="paymentMode" value={form.paymentMode} onChange={set('paymentMode')}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>

            <Input label="Date" id="transactionDate" type="date" value={form.transactionDate} onChange={set('transactionDate')} required />

            {isOuttake && (
              <Select label="Expense category" id="expenseCategoryId" value={form.expenseCategoryId} onChange={set('expenseCategoryId')} required>
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.publicId} value={c.publicId}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}

            <Input label="Reference number" id="referenceNumber" value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="Optional" />
            <Input label="Plot number" id="plotNumber" value={form.plotNumber} onChange={set('plotNumber')} placeholder="Optional" />
            {isOuttake && <Input label="Paid to" id="paidTo" value={form.paidTo} onChange={set('paidTo')} placeholder="Payee name" required />}
            <Input label="Description" id="description" value={form.description} onChange={set('description')} placeholder="Optional note" />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-xs text-slate-500">
              {isCustomer ? (
                <>Customer not listed? <Link to="/customers" className="font-medium text-emerald-700 hover:underline">Add a customer</Link></>
              ) : (
                <>Partner not listed? <Link to="/partners" className="font-medium text-emerald-700 hover:underline">Add a partner</Link></>
              )}
            </span>
            <Button type="submit" variant={isOuttake ? 'danger' : 'primary'} loading={loading}>
              Save entry
            </Button>
          </div>
        </Card>

        {warning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{warning}</span>
          </div>
        )}
      </form>
    </div>
  );
}