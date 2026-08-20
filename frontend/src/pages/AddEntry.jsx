import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
import { customerApi, partnerApi, categoryApi, transactionApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Select } from '../components/common/Select.jsx';
import { Card } from '../components/common/Card.jsx';
import { Modal } from '../components/common/Modal.jsx';
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
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [form, setForm] = useState(emptyForm);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [duplicate, setDuplicate] = useState(null);
  const [loadErrors, setLoadErrors] = useState({ customers: false, partners: false, categories: false });
  const [reloadKey, setReloadKey] = useState(0);

  const isOuttake = form.transactionType === TRANSACTION_TYPES.OUTTAKE;
  const isCustomer = form.sourceType === SOURCE_TYPES.CUSTOMER;
  const needsPartner = [SOURCE_TYPES.PARTNER_CAPITAL, SOURCE_TYPES.PARTNER_LOAN].includes(form.sourceType);

  useEffect(() => {
    let active = true;
    customerApi
      .listAll()
      .then((rows) => {
        if (!active) return;
        setCustomers(rows);
        setLoadErrors((e) => ({ ...e, customers: false }));
      })
      .catch((err) => {
        if (!active) return;
        console.error('AddEntry: failed to load customers', err?.message || err);
        setLoadErrors((e) => ({ ...e, customers: true }));
      });
    partnerApi
      .listAll({ activeOnly: true })
      .then((rows) => {
        if (!active) return;
        setPartners(rows);
        setLoadErrors((e) => ({ ...e, partners: false }));
      })
      .catch((err) => {
        if (!active) return;
        console.error('AddEntry: failed to load partners', err?.message || err);
        setLoadErrors((e) => ({ ...e, partners: true }));
      });
    categoryApi
      .active()
      .then((cat) => {
        if (!active) return;
        setCategories(cat || []);
        setLoadErrors((e) => ({ ...e, categories: false }));
      })
      .catch((err) => {
        if (!active) return;
        console.error('AddEntry: failed to load categories', err?.message || err);
        setLoadErrors((e) => ({ ...e, categories: true }));
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reloadOptions = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    transactionApi
      .get(editId)
      .then((tx) => {
        if (!active) return;
        setForm({
          transactionType: tx.transactionType,
          sourceType: tx.sourceType || SOURCE_TYPES.CUSTOMER,
          customerPublicId: tx.customer?.publicId || '',
          partnerPublicId: tx.partner?.publicId || '',
          amount: tx.amount,
          paymentMode: tx.paymentMode,
          transactionDate: tx.transactionDate,
          referenceNumber: tx.referenceNumber || '',
          plotNumber: tx.plotNumber || '',
          paidTo: tx.paidTo || '',
          description: tx.description || '',
          expenseCategoryId: tx.category?.publicId || '',
        });
      })
      .catch(() => toast.error('Could not load entry to edit'))
      .finally(() => active && setLoadingEdit(false));
    return () => {
      active = false;
    };
  }, [editId, toast]);

  const activeCustomers = useMemo(() => customers, [customers]);
  const activePartners = useMemo(() => partners, [partners]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const switchToOuttake = () =>
    setForm((f) => ({
      ...f,
      transactionType: TRANSACTION_TYPES.OUTTAKE,
      sourceType: '',
      customerPublicId: '',
      partnerPublicId: '',
    }));

  const switchToIntake = () =>
    setForm((f) => ({
      ...f,
      transactionType: TRANSACTION_TYPES.INTAKE,
      sourceType: f.sourceType || SOURCE_TYPES.CUSTOMER,
    }));

  const buildPayload = () => {
    const base = {
      transactionType: form.transactionType,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      transactionDate: form.transactionDate,
      referenceNumber: form.referenceNumber || undefined,
      plotNumber: form.plotNumber || undefined,
      description: form.description || undefined,
    };
    if (isOuttake) {
      base.categoryPublicId = form.expenseCategoryId;
      base.paidTo = form.paidTo || undefined;
      return base;
    }
    base.sourceType = form.sourceType;
    if (isCustomer) base.customerPublicId = form.customerPublicId;
    if (needsPartner) base.partnerPublicId = form.partnerPublicId;
    return base;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = buildPayload();
      const result = editId ? await transactionApi.update(editId, payload) : await transactionApi.create(payload);

      if (result?.duplicateWarning) {
        setDuplicate({
          count: result.duplicates?.length || 0,
          onContinue: () => navigate('/transactions'),
        });
        return;
      }

      toast.success(editId ? 'Entry updated' : isOuttake ? 'Outtake recorded' : 'Intake recorded');
      navigate('/transactions');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  if (loadingEdit) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Edit Entry" subtitle="Loading entry…" />
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">Loading entry…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={editId ? 'Edit Entry' : 'Add Entry'} subtitle={editId ? 'Update an existing entry' : 'Record an intake or outtake'} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={switchToIntake}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                !isOuttake ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ArrowDownLeft className="h-4 w-4" /> Intake
            </button>
            <button
              type="button"
              onClick={switchToOuttake}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                isOuttake ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" /> Outtake
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isOuttake && (
              <>
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
                {isCustomer && loadErrors.customers && (
                  <div className="col-span-2 text-xs font-medium text-red-600" role="alert">
                    Could not load customers.{' '}
                    <button type="button" className="underline" onClick={reloadOptions}>
                      Retry
                    </button>
                  </div>
                )}
                {isCustomer && !loadErrors.customers && activeCustomers.length === 0 && (
                  <div className="col-span-2 text-xs text-slate-500">
                    No customers yet.{' '}
                    <Link to="/customers" className="font-medium text-emerald-700 hover:underline">
                      Add a customer
                    </Link>
                  </div>
                )}
                {needsPartner && loadErrors.partners && (
                  <div className="col-span-2 text-xs font-medium text-red-600" role="alert">
                    Could not load partners.{' '}
                    <button type="button" className="underline" onClick={reloadOptions}>
                      Retry
                    </button>
                  </div>
                )}
                {needsPartner && !loadErrors.partners && activePartners.length === 0 && (
                  <div className="col-span-2 text-xs text-slate-500">
                    No partners yet.{' '}
                    <Link to="/partners" className="font-medium text-emerald-700 hover:underline">
                      Add a partner
                    </Link>
                  </div>
                )}
              </>
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
              <>
                <Select label="Expense category" id="expenseCategoryId" value={form.expenseCategoryId} onChange={set('expenseCategoryId')} required>
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.publicId} value={c.publicId}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Input label="Paid to" id="paidTo" value={form.paidTo} onChange={set('paidTo')} placeholder="Payee name" required />
                {loadErrors.categories && (
                  <div className="col-span-2 text-xs font-medium text-red-600" role="alert">
                    Could not load categories.{' '}
                    <button type="button" className="underline" onClick={reloadOptions}>
                      Retry
                    </button>
                  </div>
                )}
                {!loadErrors.categories && categories.length === 0 && (
                  <div className="col-span-2 text-xs text-slate-500">
                    No categories yet.{' '}
                    <Link to="/categories" className="font-medium text-emerald-700 hover:underline">
                      Add a category
                    </Link>
                  </div>
                )}
              </>
            )}

            <Input label="Reference number" id="referenceNumber" value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="Optional" />
            <Input label="Plot number" id="plotNumber" value={form.plotNumber} onChange={set('plotNumber')} placeholder="Optional" />
            <Input label="Description" id="description" value={form.description} onChange={set('description')} placeholder="Optional note" />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-xs text-slate-500">
              {isOuttake ? (
                <>Category missing? <Link to="/categories" className="font-medium text-emerald-700 hover:underline">Manage categories</Link></>
              ) : isCustomer ? (
                <>Customer not listed? <Link to="/customers" className="font-medium text-emerald-700 hover:underline">Add a customer</Link></>
              ) : (
                <>Partner not listed? <Link to="/partners" className="font-medium text-emerald-700 hover:underline">Add a partner</Link></>
              )}
            </span>
            <Button type="submit" variant={isOuttake ? 'danger' : 'primary'} loading={loading}>
              {editId ? 'Update entry' : 'Save entry'}
            </Button>
          </div>
        </Card>
      </form>

      <Modal
        open={Boolean(duplicate)}
        onClose={() => setDuplicate(null)}
        title="Possible duplicate entry"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicate(null)}>
              Stay here
            </Button>
            <Button onClick={() => duplicate?.onContinue()}>Continue to transactions</Button>
          </>
        }
      >
        <div className="flex items-start gap-2 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            A similar entry was already recorded in the last 15 minutes ({duplicate?.count || 0} possible duplicate
            {duplicate?.count === 1 ? '' : 's'}). Your entry has been saved, but please review it before recording more
            entries.
          </span>
        </div>
      </Modal>
    </div>
  );
}