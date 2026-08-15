import { useEffect, useMemo, useState } from 'react';
import * as reportService from '../services/report.service.js';
import * as customerService from '../services/customer.service.js';
import * as plotService from '../services/plot.service.js';
import * as categoryService from '../services/category.service.js';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency, formatDate } from '../utils/format.js';

const REPORT_TYPES = [
  { value: 'customers', label: 'Customer Report' },
  { value: 'plots', label: 'Plot Report' },
  { value: 'payments', label: 'Payment Report' },
  { value: 'expenses', label: 'Expense Report' },
  { value: 'income', label: 'Income Report' },
  { value: 'financial', label: 'Combined Financial Report' },
];

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const PLOT_STATUSES = ['Available', 'Reserved', 'Allocated', 'Sold'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function computeDateRange(preset, customFrom, customTo) {
  const now = new Date();
  if (preset === 'today') return { dateFrom: ymd(startOfDay(now)), dateTo: ymd(endOfDay(now)) };
  if (preset === 'thisWeek') {
    const day = (now.getDay() + 6) % 7;
    const start = startOfDay(new Date(now.getTime() - day * 86400000));
    return { dateFrom: ymd(start), dateTo: ymd(endOfDay(now)) };
  }
  if (preset === 'thisMonth') {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    return { dateFrom: ymd(start), dateTo: ymd(endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))) };
  }
  if (preset === 'lastMonth') {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    return { dateFrom: ymd(start), dateTo: ymd(endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))) };
  }
  if (preset === 'thisYear') {
    const start = startOfDay(new Date(now.getFullYear(), 0, 1));
    return { dateFrom: ymd(start), dateTo: ymd(endOfDay(new Date(now.getFullYear(), 11, 31))) };
  }
  return { dateFrom: customFrom || '', dateTo: customTo || '' };
}

const COLUMN_DEFS = {
  customers: [
    { key: 'name', header: 'Customer' },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    { key: 'plotCount', header: 'Plots' },
    { key: 'agreementValue', header: 'Agreement Value', money: true },
    { key: 'paymentReceived', header: 'Payments Received', money: true },
    { key: 'outstanding', header: 'Outstanding', money: true },
  ],
  plots: [
    { key: 'plotNumber', header: 'Plot' },
    { key: 'area', header: 'Area' },
    { key: 'areaUnit', header: 'Unit' },
    { key: 'location', header: 'Location' },
    { key: 'status', header: 'Status' },
    { key: 'listPrice', header: 'List Price', money: true },
    { key: 'agreementAmount', header: 'Agreement', money: true },
    { key: 'customerName', header: 'Customer' },
    { key: 'paid', header: 'Paid', money: true },
    { key: 'outstanding', header: 'Outstanding', money: true },
  ],
  payments: [
    { key: 'date', header: 'Date' },
    { key: 'customerName', header: 'Customer' },
    { key: 'plotNumber', header: 'Plot' },
    { key: 'amount', header: 'Amount', money: true },
    { key: 'method', header: 'Method' },
    { key: 'reference', header: 'Reference' },
    { key: 'notes', header: 'Notes' },
  ],
  expenses: [
    { key: 'date', header: 'Date' },
    { key: 'categoryName', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'reference', header: 'Reference' },
    { key: 'amount', header: 'Amount', money: true },
    { key: 'notes', header: 'Notes' },
  ],
  income: [
    { key: 'date', header: 'Date' },
    { key: 'categoryName', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'reference', header: 'Reference' },
    { key: 'amount', header: 'Amount', money: true },
    { key: 'notes', header: 'Notes' },
  ],
  financial: [],
};

function cellText(col, row) {
  const v = row[col.key];
  if (col.money) {
    if (v === null || v === undefined || v === '') return '—';
    return formatCurrency(v);
  }
  if (col.key === 'date') return formatDate(v);
  return v === null || v === undefined ? '—' : String(v);
}

function SummaryCards({ report }) {
  const s = report.summary;
  const card = (label, value, cls = 'text-navy') => (
    <Card className="p-4">
      <p className="font-mono text-xs uppercase tracking-wider text-navy/50">{label}</p>
      <p className={`mt-2 font-mono text-xl ${cls}`}>{value}</p>
    </Card>
  );
  if (report.reportType === 'financial') {
    const op = Number(s.operatingIncomeResult || 0);
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {card('Customer Payments Received', formatCurrency(s.customerPaymentsReceived), 'text-mint')}
        {card('Other Income', formatCurrency(s.otherIncome), 'text-mint')}
        {card('Expenses', formatCurrency(s.expenses), 'text-orange')}
        {card('Operating Income Result', formatCurrency(s.operatingIncomeResult), op >= 0 ? 'text-mint' : 'text-orange')}
        {card('Outstanding Receivables', formatCurrency(s.outstandingReceivables), 'text-orange')}
      </div>
    );
  }
  if (report.reportType === 'customers') {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {card('Customers', s.customers)}
        {card('Total Agreement Value', formatCurrency(s.agreementValue))}
        {card('Total Payments Received', formatCurrency(s.paymentReceived), 'text-mint')}
        {card('Total Outstanding', formatCurrency(s.outstanding), 'text-orange')}
      </div>
    );
  }
  if (report.reportType === 'plots') {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {card('Plots', s.plots)}
        {card('Total Agreement Value', formatCurrency(s.agreementValue))}
        {card('Total Paid', formatCurrency(s.totalPaid), 'text-mint')}
        {card('Total Outstanding', formatCurrency(s.totalOutstanding), 'text-orange')}
      </div>
    );
  }
  if (report.reportType === 'payments') {
    return <div className="grid grid-cols-2 gap-4 md:grid-cols-2">{card('Total Payments Received', formatCurrency(s.totalPayments), 'text-mint')}</div>;
  }
  if (report.reportType === 'expenses') {
    return <div className="grid grid-cols-2 gap-4 md:grid-cols-2">{card('Total Expenses', formatCurrency(s.totalExpenses), 'text-orange')}</div>;
  }
  if (report.reportType === 'income') {
    return <div className="grid grid-cols-2 gap-4 md:grid-cols-2">{card('Total Other Income', formatCurrency(s.totalOtherIncome), 'text-mint')}</div>;
  }
  return null;
}

const labelClass = 'block font-mono text-xs uppercase tracking-wider text-navy/50';
const inputClass =
  'mt-1 w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy focus:border-indigo focus:outline-none';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [plots, setPlots] = useState([]);
  const [categories, setCategories] = useState([]);

  const [search, setSearch] = useState('');
  const [hasPlots, setHasPlots] = useState('all');
  const [status, setStatus] = useState('All');
  const [customer, setCustomer] = useState('All');
  const [plot, setPlot] = useState('All');
  const [location, setLocation] = useState('');
  const [method, setMethod] = useState('All');
  const [category, setCategory] = useState('All');
  const [datePreset, setDatePreset] = useState('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    customerService.listCustomers({ limit: 200 }).then((r) => setCustomers(r.items || [])).catch(() => {});
    plotService.listPlots({ limit: 200 }).then((r) => setPlots(r.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (reportType === 'expenses') {
      categoryService.listCategories({ type: 'expense' }).then((r) => setCategories(r.items || [])).catch(() => setCategories([]));
    } else if (reportType === 'income') {
      categoryService.listCategories({ type: 'income' }).then((r) => setCategories(r.items || [])).catch(() => setCategories([]));
    }
  }, [reportType]);

  const usesDate = reportType === 'payments' || reportType === 'expenses' || reportType === 'income' || reportType === 'financial';
  const range = useMemo(() => computeDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo]);

  function buildParams() {
    const p = {};
    if (page > 1) p.page = page;
    if (reportType === 'customers') {
      if (search.trim()) p.search = search.trim();
      if (hasPlots !== 'all') p.hasPlots = hasPlots;
    }
    if (reportType === 'plots') {
      if (status !== 'All') p.status = status;
      if (customer !== 'All') p.customer = customer;
      if (location.trim()) p.location = location.trim();
    }
    if (reportType === 'payments') {
      if (range.dateFrom) p.dateFrom = range.dateFrom;
      if (range.dateTo) p.dateTo = range.dateTo;
      if (customer !== 'All') p.customer = customer;
      if (plot !== 'All') p.plot = plot;
      if (method !== 'All') p.method = method;
    }
    if (reportType === 'expenses' || reportType === 'income') {
      if (range.dateFrom) p.dateFrom = range.dateFrom;
      if (range.dateTo) p.dateTo = range.dateTo;
      if (category !== 'All') p.category = category;
    }
    if (reportType === 'financial') {
      if (range.dateFrom) p.dateFrom = range.dateFrom;
      if (range.dateTo) p.dateTo = range.dateTo;
    }
    return p;
  }

  function doGenerate(targetPage) {
    setLoading(true);
    setError('');
    setPage(targetPage);
    const p = buildParams();
    if (targetPage > 1) p.page = targetPage;
    reportService
      .generateReport(reportType, p)
      .then((r) => {
        setResult(r);
        toast.success('Report generated successfully.');
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to generate report.')))
      .finally(() => setLoading(false));
  }

  function handleGenerate() {
    doGenerate(1);
  }

  async function handleDownload(format) {
    if (exporting) return;
    setExporting(true);
    try {
      await reportService.downloadReport(reportType, buildParams(), format);
      toast.success(`Exported ${format.toUpperCase()} report.`);
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to export ${format}.`));
    } finally {
      setExporting(false);
    }
  }

  const columns = COLUMN_DEFS[reportType] || [];

  return (
    <section className="print-area">
      <div className="print:hidden">
        <h1 className="font-display text-3xl text-navy">Reports</h1>
        <p className="mt-1 font-sans text-sm text-navy/60">
          Generate business reports. Exports and the on-screen report use identical backend calculations.
        </p>

        {/* Report type */}
        <div className="mt-6 max-w-xl">
          <label className={labelClass}>Report Type</label>
          <select className={inputClass} value={reportType} onChange={(e) => setReportType(e.target.value)}>
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic filters */}
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
          {usesDate && (
            <>
              <div>
                <label className={labelClass}>Date Range</label>
                <select
                  className={inputClass}
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                >
                  {DATE_PRESETS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              {datePreset === 'custom' && (
                <>
                  <div>
                    <label className={labelClass}>From</label>
                    <input type="date" className={inputClass} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>To</label>
                    <input type="date" className={inputClass} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                </>
              )}
            </>
          )}

          {reportType === 'customers' && (
            <>
              <div>
                <label className={labelClass}>Search</label>
                <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name / phone / email" />
              </div>
              <div>
                <label className={labelClass}>Has Plots</label>
                <select className={inputClass} value={hasPlots} onChange={(e) => setHasPlots(e.target.value)}>
                  <option value="all">All</option>
                  <option value="with">With plots</option>
                  <option value="without">Without plots</option>
                </select>
              </div>
            </>
          )}

          {reportType === 'plots' && (
            <>
              <div>
                <label className={labelClass}>Status</label>
                <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="All">All</option>
                  {PLOT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Customer</label>
                <select className={inputClass} value={customer} onChange={(e) => setCustomer(e.target.value)}>
                  <option value="All">All</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location text" />
              </div>
            </>
          )}

          {reportType === 'payments' && (
            <>
              <div>
                <label className={labelClass}>Customer</label>
                <select className={inputClass} value={customer} onChange={(e) => setCustomer(e.target.value)}>
                  <option value="All">All</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Plot</label>
                <select className={inputClass} value={plot} onChange={(e) => setPlot(e.target.value)}>
                  <option value="All">All</option>
                  {plots.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.plotNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Method</label>
                <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="All">All</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(reportType === 'expenses' || reportType === 'income') && (
            <div>
              <label className={labelClass}>Category</label>
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button onClick={handleGenerate} loading={loading}>
            Generate Report
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-navy">
                {REPORT_TYPES.find((t) => t.value === result.reportType)?.label}
              </h2>
              <p className="font-mono text-xs text-navy/50">
                Generated {new Date(result.generatedAt).toLocaleString()} · Filters: {JSON.stringify(result.filters)}
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button onClick={() => handleDownload('pdf')} disabled={exporting} className="rounded border border-navy/20 px-3 py-1 font-sans text-sm text-navy hover:bg-navy/5 disabled:opacity-50">
                Download PDF
              </button>
              <button onClick={() => handleDownload('excel')} disabled={exporting} className="rounded border border-navy/20 px-3 py-1 font-sans text-sm text-navy hover:bg-navy/5 disabled:opacity-50">
                Download Excel
              </button>
              <button onClick={() => handleDownload('csv')} disabled={exporting} className="rounded border border-navy/20 px-3 py-1 font-sans text-sm text-navy hover:bg-navy/5 disabled:opacity-50">
                Download CSV
              </button>
              <button onClick={() => window.print()} disabled={exporting} className="rounded border border-navy/20 px-3 py-1 font-sans text-sm text-navy hover:bg-navy/5 disabled:opacity-50">
                Print
              </button>
            </div>
          </div>

          <div className="mt-4">
            <SummaryCards report={result} />
          </div>

          {result.reportType === 'financial' ? (
            <p className="mt-4 font-sans text-sm text-navy/60">
              Operating Income Result = Other Income − Expenses. Customer Payments Received and Outstanding Receivables are
              separate property/customer metrics and are not part of the operating result.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow-sm">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-navy text-chalk">
                  <tr className="font-mono text-xs uppercase tracking-wider">
                    {columns.map((c) => (
                      <th key={c.key} className="px-4 py-3">
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-6 text-center font-sans text-navy/60">
                        No records found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row, i) => (
                      <tr key={row._id || i} className="border-b border-navy/5">
                        {columns.map((c) => (
                          <td key={c.key} className={`px-4 py-3 ${c.money ? 'text-right font-mono text-sm text-mint' : 'font-sans text-navy'}`}>
                            {cellText(c, row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {result.pagination && result.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3 font-sans text-sm text-navy/60 print:hidden">
              <button
                disabled={result.pagination.page <= 1}
                onClick={() => doGenerate(result.pagination.page - 1)}
                className="rounded border border-navy/15 px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {result.pagination.page} of {result.pagination.totalPages}
              </span>
              <button
                disabled={result.pagination.page >= result.pagination.totalPages}
                onClick={() => doGenerate(result.pagination.page + 1)}
                className="rounded border border-navy/15 px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <Spinner size="sm" className="mt-6" />}
    </section>
  );
}
