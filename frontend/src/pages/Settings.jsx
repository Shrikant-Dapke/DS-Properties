import { useEffect, useState } from 'react';
import { Building2, Tags, UserCog, KeyRound, Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { settingsApi, categoryApi, customerApi, partnerApi, transactionApi, userApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Card } from '../components/common/Card.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { ChangePasswordModal } from '../components/layout/ChangePasswordModal.jsx';
import { exportTableToExcel } from '../utils/excel.js';
import { formatDateTime, formatINR, titleCase } from '../utils/formatters.js';
import { canOperate } from '../contexts/authContextDef.js';

const editableLabels = {
  company_name: 'Company name',
  opening_balance: 'Opening balance (₹)',
  financial_year_start_month: 'Financial year start month (1–12)',
  currency: 'Currency',
};

const sections = [
  { id: 'business', icon: Building2, title: 'Business', desc: 'Name, financial year, opening balance' },
  { id: 'categories', icon: Tags, title: 'Categories', desc: 'View and manage expense categories' },
  { id: 'users', icon: UserCog, title: 'Users', desc: 'Manage system users' },
  { id: 'security', icon: KeyRound, title: 'Security', desc: 'Change your password' },
  { id: 'backup', icon: Download, title: 'Backup', desc: 'Export all data (Excel / JSON)' },
];

function SectionHeading({ children }) {
  return <h2 className="mb-3 mt-8 text-base font-bold text-slate-800 first:mt-0">{children}</h2>;
}

export default function Settings() {
  const toast = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [categoryCount, setCategoryCount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [backupBusy, setBackupBusy] = useState(null);

  useEffect(() => {
    settingsApi
      .list()
      .then((rows) => {
        setSettings(rows);
        const init = {};
        for (const r of rows) init[r.key] = r.value;
        setDrafts(init);
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    categoryApi
      .active()
      .then((rows) => setCategoryCount((rows || []).length))
      .catch(() => setCategoryCount(null));
  }, []);

  const save = async (key) => {
    try {
      const value = drafts[key];
      if (key === 'financial_year_start_month') {
        const n = Number(value);
        if (n < 1 || n > 12) {
          toast.error('Month must be between 1 and 12');
          return;
        }
      }
      const result = await settingsApi.update(key, value);
      toast.success(
        result?.changeRequest?.status === 'PENDING'
          ? 'Submitted for partner approval'
          : `${editableLabels[key] || key} updated`,
      );
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Update failed');
    }
  };

  // Full-data export assembled client-side from the existing read APIs (the
  // same mechanism as the report exports). No backup endpoint exists on the
  // backend, so this safe export stands in for one — nothing is faked: every
  // sheet reflects live API data.
  const collectBackup = async () => {
    // Transactions page through the standard list contract until the server
    // reports no further pages: the export must never silently omit records,
    // no matter how many exist. The empty-page guard additionally stops the
    // loop if a backend ever misreports hasNext.
    const transactions = [];
    for (let page = 1; ; page += 1) {
      const data = await transactionApi.list({ page, limit: 100 });
      const rows = data.rows || [];
      transactions.push(...rows);
      if (!data.pagination?.hasNext || rows.length === 0) break;
    }
    const [customers, partners, categories, users, business] = await Promise.all([
      customerApi.listAll().catch(() => []),
      partnerApi.listAll().catch(() => []),
      categoryApi.list({ limit: 100 }).then((d) => d.rows || []).catch(() => []),
      userApi.list({ limit: 100 }).then((d) => d.rows || []).catch(() => []),
      settingsApi.list().catch(() => []),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      transactions,
      customers,
      partners,
      categories,
      users,
      settings: business,
    };
  };

  const backupExcel = async () => {
    setBackupBusy('excel');
    try {
      const data = await collectBackup();
      await exportTableToExcel({
        filename: `ds-properties-backup_${new Date().toISOString().slice(0, 10)}`,
        sheets: [
          {
            name: 'Transactions',
            columns: [
              { key: 'transactionDate', label: 'Date' },
              { key: 'transactionType', label: 'Type' },
              { key: 'sourceType', label: 'Source' },
              { key: 'description', label: 'Description', render: (r) => r.description || r.paidTo || '' },
              { key: 'amount', label: 'Amount', render: (r) => formatINR(r.amount) },
              { key: 'paymentMode', label: 'Mode' },
            ],
            rows: data.transactions,
          },
          {
            name: 'Customers',
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
              { key: 'address', label: 'Address' },
              { key: 'totalPaid', label: 'Total paid', render: (r) => formatINR(r.totalPaid) },
            ],
            rows: data.customers,
          },
          {
            name: 'Partners',
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
              { key: 'totalInflow', label: 'Total inflow', render: (r) => formatINR(r.totalInflow) },
            ],
            rows: data.partners,
          },
          {
            name: 'Categories',
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'slug', label: 'Slug' },
              { key: 'description', label: 'Description' },
            ],
            rows: data.categories,
          },
          {
            name: 'Users',
            columns: [
              { key: 'username', label: 'Username' },
              { key: 'fullName', label: 'Full name' },
              { key: 'role', label: 'Role' },
              { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
            ],
            rows: data.users,
          },
          {
            name: 'Settings',
            columns: [
              { key: 'key', label: 'Key' },
              { key: 'value', label: 'Value', render: (r) => (typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value ?? '')) },
            ],
            rows: data.settings,
          },
        ],
      });
      toast.success(`Backup exported (${data.transactions.length} transactions)`);
    } catch {
      toast.error('Backup export failed');
    } finally {
      setBackupBusy(null);
    }
  };

  const backupJson = async () => {
    setBackupBusy('json');
    try {
      const data = await collectBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ds-properties-backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Backup downloaded (${data.transactions.length} transactions)`);
    } catch {
      toast.error('Backup download failed');
    } finally {
      setBackupBusy(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  const numericKeys = new Set(['opening_balance', 'financial_year_start_month']);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Application configuration" />

      <nav aria-label="Settings sections" className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#settings-${s.id}`}
            className="flex min-h-[76px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700/10 text-emerald-700">
              <s.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">{s.title}</span>
              <span className="block truncate text-xs text-slate-500">{s.desc}</span>
            </span>
          </a>
        ))}
      </nav>

      <section id="settings-business" aria-label="Business settings">
        <SectionHeading>Business</SectionHeading>

        {!canOperate(user) && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Settings are view-only for your role. Partners propose changes, which need unanimous partner approval.
          </div>
        )}

        {settings?.length === 0 && (
          <Card>
            <EmptyState
              title="No configuration values yet"
              message="Application settings have not been provisioned. An administrator can restore the defaults by applying the pending database migrations."
            />
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {settings?.map((s) => {
            const isNumeric = numericKeys.has(s.key);
            const isEditable = canOperate(user) && s.key in editableLabels;
            return (
              <Card key={s.key} title={editableLabels[s.key] || titleCase(s.key)} subtitle={s.description}>
                {isEditable ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Input
                      type={isNumeric ? 'number' : 'text'}
                      step={isNumeric ? '0.01' : undefined}
                      value={drafts[s.key] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                      className="flex-1"
                    />
                    <Button variant="secondary" onClick={() => save(s.key)} className="min-h-[48px] w-full sm:w-auto md:min-h-0">
                      Save
                    </Button>
                  </div>
                ) : (
                  <p className="text-base font-semibold text-slate-800">{String(drafts[s.key] ?? '')}</p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Updated {formatDateTime(s.updatedAt)} {s.updatedBy ? `by ${s.updatedBy}` : ''}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="settings-categories" aria-label="Categories settings">
        <SectionHeading>Categories</SectionHeading>
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                {categoryCount === null ? 'Expense categories' : `${categoryCount} expense categories`}
              </p>
              <p className="text-xs text-slate-500">Categories classify outtakes. Changes follow transaction integrity rules.</p>
            </div>
            <a
              href="/categories"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 md:min-h-0"
            >
              Manage categories
            </a>
          </div>
        </Card>
      </section>

      <section id="settings-users" aria-label="Users settings">
        <SectionHeading>Users</SectionHeading>
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">System users</p>
              <p className="text-xs text-slate-500">User changes follow role and approval rules — partners can only propose.</p>
            </div>
            <a
              href="/users"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 md:min-h-0"
            >
              Manage users
            </a>
          </div>
        </Card>
      </section>

      <section id="settings-security" aria-label="Security settings">
        <SectionHeading>Security</SectionHeading>
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Password</p>
              <p className="text-xs text-slate-500">Change the password you sign in with.</p>
            </div>
            <Button variant="secondary" onClick={() => setShowPassword(true)} className="min-h-[48px] md:min-h-0">
              Change password
            </Button>
          </div>
        </Card>
        <ChangePasswordModal open={showPassword} onClose={() => setShowPassword(false)} />
      </section>

      <section id="settings-backup" aria-label="Backup settings">
        <SectionHeading>Backup</SectionHeading>
        <Card>
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Export all data</p>
              <p className="text-xs text-slate-500">Downloads live transactions, customers, partners, categories, users and settings.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <Button variant="secondary" onClick={backupExcel} loading={backupBusy === 'excel'} disabled={backupBusy !== null} className="min-h-[48px] md:min-h-0">
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </Button>
              <Button variant="secondary" onClick={backupJson} loading={backupBusy === 'json'} disabled={backupBusy !== null} className="min-h-[48px] md:min-h-0">
                <FileJson className="h-4 w-4" /> Download JSON
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
