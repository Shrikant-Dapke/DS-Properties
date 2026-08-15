import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as dashboardService from '../services/dashboard.service.js';

function formatINR(value) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Card({ label, value, valueClass = 'text-navy', sub = '' }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-wider text-navy/50">{label}</p>
      <p className={`mt-2 font-mono text-xl ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 font-sans text-xs text-navy/50">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="mb-3 mt-8 font-display text-xl text-navy">{children}</h2>;
}

function StatusBanner({ loading, error }) {
  if (loading) {
    return (
      <div className="rounded border border-navy/10 bg-white px-4 py-3 font-mono text-sm text-navy/50">
        Loading dashboard…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded border border-orange bg-orange/10 px-4 py-3 text-sm text-orange">
        {error}
      </div>
    );
  }
  return null;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [recent, setRecent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      dashboardService.getDashboardSummary(),
      dashboardService.getDashboardTrends(),
      dashboardService.getDashboardRecent({ limit: 5 }),
    ])
      .then(([s, t, r]) => {
        setSummary(s);
        setTrends(t);
        setRecent(r);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const banner = <StatusBanner loading={loading} error={error} />;

  if (loading || error) {
    return (
      <section>
        <h1 className="font-display text-3xl text-navy">Dashboard</h1>
        <div className="mt-4">{banner}</div>
      </section>
    );
  }

  const operating = Number(summary.operatingResult.amount || 0);
  const outstanding = Number(summary.receivables.totalOutstanding || 0);

  const hasData =
    summary.customers.total > 0 ||
    summary.plots.total > 0 ||
    Number(summary.payments.totalReceived) > 0 ||
    Number(summary.income.totalOtherIncome) > 0 ||
    Number(summary.expenses.totalExpenses) > 0;

  return (
    <section>
      <h1 className="font-display text-3xl text-navy">Dashboard</h1>
      <p className="mt-1 font-sans text-sm text-navy/60">
        Current state of DS Properties. Property and receivable figures are current; financial
        totals reflect all recorded activity unless a date range is applied.
      </p>

      {!hasData && (
        <div className="mt-4 rounded border border-navy/10 bg-white px-4 py-6 text-center font-sans text-navy/60">
          No data yet. Add customers, plots, payments, income, and expenses to populate the dashboard.
        </div>
      )}

      {/* Property overview */}
      <SectionTitle>Property Overview</SectionTitle>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Total Customers" value={summary.customers.total} />
        <Card label="Total Plots" value={summary.plots.total} />
        <Card label="Available Plots" value={summary.plots.available} sub="Unassigned / on market" />
        <Card label="Sold Plots" value={summary.plots.sold} />
      </div>

      {/* Receivables */}
      <SectionTitle>Customer Payments & Receivables</SectionTitle>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card
          label="Customer Payments Received"
          value={formatINR(summary.payments.totalReceived)}
          valueClass="text-mint"
          sub="Plot installments only"
        />
        <Card
          label="Outstanding Receivables"
          value={formatINR(summary.receivables.totalOutstanding)}
          valueClass="text-orange"
          sub="Money still owed by customers"
        />
        <Card
          label="Fully Paid Plots"
          value={summary.receivables.fullyPaidPlots}
          sub={`${summary.receivables.outstandingPlots} with balance`}
        />
      </div>

      {/* Business finance */}
      <SectionTitle>Business Financial Result</SectionTitle>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card label="Other Income" value={formatINR(summary.income.totalOtherIncome)} valueClass="text-mint" sub="Income records only" />
        <Card label="Expenses" value={formatINR(summary.expenses.totalExpenses)} valueClass="text-orange" sub="Excludes deleted" />
        <Card
          label="Operating Income Result"
          value={formatINR(summary.operatingResult.amount)}
          valueClass={operating >= 0 ? 'text-mint' : 'text-orange'}
          sub="Other Income − Expenses"
        />
      </div>

      {/* Recent activity */}
      <SectionTitle>Recent Activity</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RecentColumn
          title="Payments"
          to="/payments"
          items={recent.payments}
          render={(p) => (
            <>
              <span className="font-mono text-mint">{formatINR(p.amount)}</span>
              <span className="ml-2 font-sans text-navy/60">
                {p.customerId?.name || '—'} · {p.plotId?.plotNumber || '—'}
              </span>
            </>
          )}
          dateOf={(p) => p.date}
        />
        <RecentColumn
          title="Income"
          to="/income"
          items={recent.income}
          render={(i) => (
            <>
              <span className="font-mono text-mint">{formatINR(i.amount)}</span>
              <span className="ml-2 font-sans text-navy/60">{i.categoryId?.name || '—'}</span>
            </>
          )}
          dateOf={(i) => i.date}
        />
        <RecentColumn
          title="Expenses"
          to="/expenses"
          items={recent.expenses}
          render={(e) => (
            <>
              <span className="font-mono text-orange">{formatINR(e.amount)}</span>
              <span className="ml-2 font-sans text-navy/60">{e.categoryId?.name || '—'}</span>
            </>
          )}
          dateOf={(e) => e.date}
        />
      </div>

      {/* Trends */}
      <SectionTitle>Monthly Trends</SectionTitle>
      {trends.length === 0 ? (
        <p className="font-sans text-sm text-navy/60">No financial activity recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Payments</th>
                <th className="px-4 py-3 text-right">Other Income</th>
                <th className="px-4 py-3 text-right">Expenses</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => (
                <tr key={t.period} className="border-b border-navy/5">
                  <td className="px-4 py-3 font-mono text-sm text-navy">{t.period}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-mint">{formatINR(t.payments)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-mint">{formatINR(t.income)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-orange">{formatINR(t.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentColumn({ title, to, items, render, dateOf }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-navy/50">{title}</h3>
        <Link to={to} className="font-sans text-xs text-lavender hover:underline">
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 font-sans text-sm text-navy/50">None yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <li key={it._id} className="border-b border-navy/5 pb-2 text-sm">
              <div>{render(it)}</div>
              <div className="font-mono text-xs text-navy/40">
                {dateOf(it) ? new Date(dateOf(it)).toLocaleDateString() : '—'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
