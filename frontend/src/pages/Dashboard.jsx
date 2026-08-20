import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { PlusCircle, ArrowUpRight, ArrowDownRight, Wallet, Scale } from 'lucide-react';
import { dashboardApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { useAuth } from '../hooks/useAuth.js';
import { formatINR } from '../utils/formatters.js';
import { DATE_MODES, financialYearRange } from '../utils/dateRange.js';
import { canWrite } from '../contexts/authContextDef.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { DateRangeFilter } from '../components/common/DateRangeFilter.jsx';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const colors = [
  '#059669', '#0284c7', '#7c3aed', '#ea580c', '#db2777', '#65a30d', '#0891b2', '#eab308',
];

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => ({ mode: DATE_MODES.YEARLY, ...financialYearRange() }));

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = range.from ? { from: range.from, to: range.to } : {};
    Promise.all([dashboardApi.summary(params), dashboardApi.categoryBreakdown(params)])
      .then(([summary, categories]) => {
        if (!active) return;
        setData(summary);
        setCategoryBreakdown(categories);
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toast, range]);

  const { chartData, breakdownRows } = useMemo(() => {
    const rows = categoryBreakdown || [];
    const sorted = [...rows].sort((a, b) => Number(b.total_outtake) - Number(a.total_outtake));
    return {
      chartData: {
        labels: sorted.map((c) => c.category_name),
        datasets: [
          {
            label: 'Outtakes',
            data: sorted.map((c) => Number(c.total_outtake)),
            backgroundColor: colors,
            borderWidth: 0,
          },
        ],
      },
      breakdownRows: sorted,
    };
  }, [categoryBreakdown]);

  const totals = data?.totals || {};
  const period = data?.period || {};
  const fy = data?.financialYear || {};

  const stats = [
    { label: 'Current balance', value: formatINR(data?.balance), icon: Wallet, tone: 'text-emerald-700 bg-emerald-50' },
    { label: `Intakes (${period.from ?? '…'} → ${period.to ?? '…'})`, value: formatINR(period.intake), icon: ArrowUpRight, tone: 'text-emerald-600 bg-emerald-50' },
    { label: `Outtakes (${period.from ?? '…'} → ${period.to ?? '…'})`, value: formatINR(period.outtake), icon: ArrowDownRight, tone: 'text-red-600 bg-red-50' },
    { label: 'Net (selected period)', value: formatINR(period.net), icon: Scale, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Period opening', value: formatINR(period.openingBalance), icon: Wallet, tone: 'text-indigo-700 bg-indigo-50' },
  ];

  if (loading && !data) return <LoadingSpinner label="Loading dashboard…" />;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.fullName || user.username}`}
        subtitle={fy.from && fy.to ? `Financial year ${fy.startYear}–${fy.startYear + 1} (${fy.from} → ${fy.to})` : "Here's what's happening with your finances"}
        actions={
          canWrite(user) && (
            <Link
              to="/entries/new"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              <PlusCircle className="h-4 w-4" /> Add Entry
            </Link>
          )
        }
      />

      <Card pad={false} className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Reporting period</p>
            <p className="text-xs text-slate-500">Intakes, outtakes, net and the category charts follow this period.</p>
          </div>
          <DateRangeFilter
            defaultMode={DATE_MODES.YEARLY}
            onChange={setRange}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} pad={false}>
            <div className="p-4">
              <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="mt-0.5 text-lg font-bold text-slate-800">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Outtakes by category" subtitle={`${period.from ?? '…'} → ${period.to ?? '…'}`}>
          {chartData && chartData.labels.length > 0 ? (
            <div className="h-72">
              <Doughnut data={chartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No outtakes in this period yet.</p>
          )}
        </Card>

        <Card title="Category breakdown" subtitle="Net outtakes, selected period">
          {breakdownRows && breakdownRows.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {breakdownRows.slice(0, 8).map((c, i) => (
                <li key={c.public_id ?? c.category_name} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                    <span className="text-sm text-slate-700">{c.category_name}</span>
                    <span className="text-xs text-slate-400">×{c.outtake_count}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{formatINR(c.total_outtake)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No data yet.</p>
          )}
        </Card>
      </div>

      {data?.recentTransactions?.length > 0 && (
        <Card title="Recent activity" className="mt-5" actions={<Link to="/transactions" className="text-xs font-medium text-emerald-700 hover:underline">View all</Link>}>
          <ul className="divide-y divide-slate-100">
            {data.recentTransactions.map((t) => (
              <li
                key={t.public_id}
                onClick={() => navigate('/transactions')}
                className="flex cursor-pointer items-center justify-between py-2.5 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      t.transaction_type === 'intake' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {t.transaction_type === 'intake' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {t.description || (t.transaction_type === 'intake' ? 'Intake' : 'Outtake')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.transaction_date} · {t.source_type}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${t.transaction_type === 'intake' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {t.transaction_type === 'intake' ? '+' : '−'}{formatINR(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        All-time totals: {formatINR(totals.totalIntake)} in · {formatINR(totals.totalOuttake)} out
        {totals.customerIntake > 0 && ` · ₹${Number(totals.customerIntake).toLocaleString('en-IN')} from customers`}
        {totals.partnerCapital > 0 && ` · ₹${Number(totals.partnerCapital).toLocaleString('en-IN')} partner capital`}
        {totals.partnerLoan > 0 && ` · ₹${Number(totals.partnerLoan).toLocaleString('en-IN')} partner loans`}
        <span className="ml-auto text-slate-400">Aggregates are cached server-side and refresh on entry changes.</span>
      </div>
    </div>
  );
}