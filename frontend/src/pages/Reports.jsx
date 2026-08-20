import { useEffect, useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { reportApi, partnerApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { Input } from '../components/common/Input.jsx';
import { Select } from '../components/common/Select.jsx';
import { Card } from '../components/common/Card.jsx';
import { Button } from '../components/common/Button.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { formatINR, formatDate, titleCase } from '../utils/formatters.js';
import { exportTableToPdf } from '../utils/pdf.js';
import { exportTableToExcel } from '../utils/excel.js';
import { DATE_TODAY } from '../utils/constants.js';

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

function ExportButtons({ pdf, excel }) {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        type="button"
        onClick={() => {
          try {
            exportTableToPdf(pdf);
          } catch {
            toast.error('PDF export failed');
          }
        }}
      >
        <FileDown className="h-4 w-4" /> PDF
      </Button>
      <Button
        variant="secondary"
        type="button"
        onClick={() => {
          exportTableToExcel(excel).catch(() => toast.error('Excel export failed'));
        }}
      >
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
    </div>
  );
}

function summaryCards(summary) {
  if (!summary) return [];
  return [
    { label: 'Intakes', value: formatINR(summary.intake ?? 0), tone: 'text-emerald-700' },
    { label: 'Outtakes', value: formatINR(summary.outtake ?? 0), tone: 'text-red-600' },
    { label: 'Customer receipts', value: formatINR(summary.customerIntake ?? 0), tone: 'text-slate-800' },
    { label: 'Partner capital', value: formatINR(summary.partnerCapital ?? 0), tone: 'text-slate-800' },
    { label: 'Partner loans', value: formatINR(summary.partnerLoan ?? 0), tone: 'text-slate-800' },
    { label: 'Net movement', value: formatINR(summary.net ?? 0), tone: 'text-blue-700' },
  ];
}

function MonthReport({ year, month }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reportApi
      .monthly({ year, month })
      .then((d) => active && setData(d))
      .catch(() => toast.error('Failed to load monthly report'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [year, month, toast]);

  if (loading) return <LoadingSpinner />;

  const txCols = [
    { key: 'transactionDate', label: 'Date', render: (r) => formatDate(r.transactionDate) },
    { key: 'transactionType', label: 'Type', render: (r) => titleCase(r.transactionType) },
    { key: 'sourceType', label: 'Source', render: (r) => titleCase(r.sourceType) },
    { key: 'description', label: 'Description', render: (r) => r.description || r.paidTo || '—' },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatINR(r.amount) },
  ];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {summaryCards(data?.summary).map((s) => (
            <Card key={s.label} pad={false}>
              <div className="p-3">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`mt-0.5 text-base font-bold ${s.tone}`}>{s.value}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="shrink-0">
          <ExportButtons
            pdf={{ title: 'Monthly Report', subtitle: `${month}/${year}`, columns: txCols, rows: data?.transactions ?? [] }}
            excel={{
              filename: `monthly_report_${year}_${month}`,
              sheets: [
                {
                  name: 'Transactions',
                  columns: txCols,
                  rows: data?.transactions ?? [],
                },
                {
                  name: 'Categories',
                  columns: [
                    { key: 'category_name', label: 'Category' },
                    { key: 'total_outtake', label: 'Outtake', render: (r) => formatINR(r.total_outtake) },
                  ],
                  rows: data?.categories ?? [],
                },
                {
                  name: 'Top customers',
                  columns: [
                    { key: 'name', label: 'Customer' },
                    { key: 'total_intake', label: 'Intake', render: (r) => formatINR(r.total_intake) },
                  ],
                  rows: data?.topCustomers ?? [],
                },
              ],
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Categories · ${month}/${year}`} subtitle="Outtakes by category" pad={false}>
          {(data?.categories ?? []).length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.categories ?? []).map((c) => (
                  <tr key={c.category_id ?? c.name}>
                    <td className="px-4 py-2.5">{c.category_name || c.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatINR(c.total_outtake)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No outtakes this month.</p>
          )}
        </Card>

        <Card title="Top customers" subtitle="This month's customers" pad={false}>
          {(data?.topCustomers ?? []).length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Intake</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.topCustomers ?? []).map((c) => (
                  <tr key={c.customer_id ?? c.name}>
                    <td className="px-4 py-2.5">{c.customer_name || c.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatINR(c.total_intake)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No customer receipts this month.</p>
          )}
        </Card>
      </div>

      <Card title="Transactions" className="mt-4" pad={false}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              {txCols.map((c) => (
                <th key={c.key} className={`px-4 py-2.5 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.transactions ?? []).map((t) => (
              <tr key={t.publicId}>
                {txCols.map((c) => (
                  <td key={c.key} className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right' : ''}`}>
                    {c.render(t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {(data?.transactions ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No transactions this month.</p>
        )}
      </Card>
    </div>
  );
}

function DailyReport({ date }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reportApi
      .daily({ date })
      .then((d) => active && setData(d))
      .catch(() => toast.error('Failed to load daily report'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [date, toast]);

  if (loading) return <LoadingSpinner />;

  const dailyCols = [
    { key: 'transactionType', label: 'Type', render: (r) => titleCase(r.transactionType) },
    { key: 'sourceType', label: 'Source', render: (r) => titleCase(r.sourceType) },
    { key: 'description', label: 'Description', render: (r) => r.description || r.paidTo || '—' },
    { key: 'amount', label: 'Amount', render: (r) => formatINR(r.amount) },
  ];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card pad={false}>
            <div className="p-4">
              <p className="text-xs text-slate-500">Opening balance</p>
              <p className="text-lg font-bold text-slate-800">{formatINR(data?.balance?.openingBalance)}</p>
            </div>
          </Card>
          <Card pad={false}>
            <div className="p-4">
              <p className="text-xs text-slate-500">Balance at end of day</p>
              <p className="text-lg font-bold text-slate-800">{formatINR(data?.balance?.balanceAtEndOfDay)}</p>
            </div>
          </Card>
          <Card pad={false}>
            <div className="p-4">
              <p className="text-xs text-slate-500">Net movement</p>
              <p className="text-lg font-bold text-blue-700">{formatINR(data?.summary?.net)}</p>
            </div>
          </Card>
        </div>
        <div className="shrink-0">
          <ExportButtons
            pdf={{ title: 'Daily Report', subtitle: date, columns: dailyCols, rows: data?.transactions ?? [] }}
            excel={{
              filename: `daily_report_${date}`,
              sheets: [{ name: 'Transactions', columns: dailyCols, rows: data?.transactions ?? [] }],
            }}
          />
        </div>
      </div>

      <Card title="Day summary" pad={false}>
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
          {summaryCards(data?.summary).map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`mt-0.5 text-base font-bold ${s.tone}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Transactions" className="mt-4" pad={false}>
        {(data?.transactions ?? []).length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {data.transactions.map((t) => (
              <li key={t.publicId} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.description || t.paidTo || titleCase(t.sourceType)}</p>
                  <p className="text-xs text-slate-500">
                    {titleCase(t.transactionType)} · {titleCase(t.sourceType)}
                  </p>
                </div>
                <span className={`text-sm font-bold ${t.transactionType === 'intake' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatINR(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">No transactions on this date.</p>
        )}
      </Card>
    </div>
  );
}

function CategoryReportView({ from, to }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reportApi
      .categories({ from, to })
      .then((d) => active && setData(d))
      .catch(() => toast.error('Failed to load category report'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [from, to, toast]);

  if (loading) return <LoadingSpinner />;

  const catCols = [
    { key: 'category_name', label: 'Category', render: (r) => r.category_name || r.name },
    { key: 'total_outtake', label: 'Total outtake', render: (r) => formatINR(r.total_outtake) },
  ];

  return (
    <div>
      <div className="mb-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <Card pad={false}>
            <div className="p-4">
              <p className="text-xs text-slate-500">Total outtake · {formatDate(from)} → {formatDate(to)}</p>
              <p className="text-xl font-bold text-red-600">{formatINR(data?.totalOuttake)}</p>
            </div>
          </Card>
          <div className="shrink-0">
            <ExportButtons
              pdf={{ title: 'Category Report', subtitle: `${from} → ${to}`, columns: catCols, rows: data?.categories ?? [] }}
              excel={{
                filename: `category_report_${from}_${to}`,
                sheets: [{ name: 'Categories', columns: catCols, rows: data?.categories ?? [] }],
              }}
            />
          </div>
        </div>
      </div>
      <Card pad={false}>
        {(data?.categories ?? []).length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Category</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total outtake</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.categories.map((c) => (
                <tr key={c.category_id ?? c.name}>
                  <td className="px-4 py-2.5">{c.category_name || c.name}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatINR(c.total_outtake)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">No outtakes in this period.</p>
        )}
      </Card>
    </div>
  );
}

function PartnerReportView({ partnerId, partners }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) return;
    let active = true;
    setLoading(true);
    reportApi
      .partner(partnerId)
      .then((d) => active && setData(d))
      .catch(() => toast.error('Failed to load partner report'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [partnerId, toast]);

  if (!partnerId) return <p className="py-10 text-center text-sm text-slate-500">Select a partner to see their report.</p>;
  if (loading) return <LoadingSpinner />;

  const ledgerCols = [
    { key: 'transactionDate', label: 'Date', render: (r) => formatDate(r.transactionDate) },
    { key: 'sourceType', label: 'Type', render: (r) => titleCase(r.sourceType) },
    { key: 'description', label: 'Description', render: (r) => r.description || r.paidTo || '—' },
    { key: 'amount', label: 'Amount', render: (r) => formatINR(r.amount) },
  ];

  const partnerLabel = partners.find((p) => p.publicId === partnerId)?.name || partnerId;
  const partnerFile = partnerLabel.replace(/[^a-z0-9]+/gi, '_').toLowerCase();

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card pad={false}>
            <div className="p-4">
              <p className="text-xs text-slate-500">Capital contributions</p>
              <p className="text-lg font-bold text-slate-800">{formatINR(data?.totals?.capitalContributions)}</p>
            </div>
          </Card>
          <Card pad={false}>
            <div className="p-4">
              <p className="text-xs text-slate-500">Loan receipts</p>
              <p className="text-lg font-bold text-slate-800">{formatINR(data?.totals?.loanReceipts)}</p>
            </div>
          </Card>
          <Card pad={false}>
            <div className="p-4">
              <p className="text-xs text-slate-500">Total inflow</p>
              <p className="text-lg font-bold text-emerald-700">{formatINR(data?.totals?.totalInflow)}</p>
            </div>
          </Card>
        </div>
        <div className="shrink-0">
          <ExportButtons
            pdf={{ title: `Partner Report — ${partnerLabel}`, subtitle: 'All-time', columns: ledgerCols, rows: data?.ledger?.rows ?? [] }}
            excel={{
              filename: `partner_report_${partnerFile}`,
              sheets: [{ name: 'Ledger', columns: ledgerCols, rows: data?.ledger?.rows ?? [] }],
            }}
          />
        </div>
      </div>

      <Card title="Ledger" pad={false}>
        {(data?.ledger?.rows ?? []).length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Description</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.ledger.rows.map((t) => (
                <tr key={t.publicId}>
                  <td className="px-4 py-2.5">{formatDate(t.transactionDate)}</td>
                  <td className="px-4 py-2.5">{titleCase(t.sourceType)}</td>
                  <td className="px-4 py-2.5">{t.description || t.paidTo || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatINR(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">No transactions for this partner.</p>
        )}
      </Card>
    </div>
  );
}

export default function Reports() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('monthly');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [date, setDate] = useState(DATE_TODAY());
  const [from, setFrom] = useState(`${currentYear - 1}-04-01`);
  const [to, setTo] = useState(`${currentYear}-03-31`);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState('');

  useEffect(() => {
    partnerApi
      .listAll()
      .then(setPartners)
      .catch(() => toast.error('Failed to load partners'));
  }, [toast]);

  const tabs = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'daily', label: 'Daily' },
    { key: 'categories', label: 'Categories' },
    { key: 'partner', label: 'Partner' },
  ];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Financial summaries and exports" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === t.key ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'monthly' && (
          <>
            <Input label="Year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" />
            <Select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-32">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' })}
                </option>
              ))}
            </Select>
          </>
        )}

        {activeTab === 'daily' && <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}

        {activeTab === 'categories' && (
          <>
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}

        {activeTab === 'partner' && (
          <Select label="Partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="w-64">
            <option value="">Select partner…</option>
            {partners.map((p) => (
              <option key={p.publicId} value={p.publicId}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {activeTab === 'monthly' && <MonthReport year={year} month={month} />}
      {activeTab === 'daily' && <DailyReport date={date} />}
      {activeTab === 'categories' && <CategoryReportView from={from} to={to} />}
      {activeTab === 'partner' && <PartnerReportView partnerId={partnerId} partners={partners} />}
    </div>
  );
}