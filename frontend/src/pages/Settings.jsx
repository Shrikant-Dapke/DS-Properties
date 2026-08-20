import { useEffect, useState } from 'react';
import { settingsApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Card } from '../components/common/Card.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { formatDateTime, titleCase } from '../utils/formatters.js';
import { isAdmin } from '../contexts/authContextDef.js';

const editableLabels = {
  company_name: 'Company name',
  opening_balance: 'Opening balance (₹)',
  financial_year_start_month: 'Financial year start month (1–12)',
  currency: 'Currency',
};

export default function Settings() {
  const toast = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);

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
      await settingsApi.update(key, value);
      toast.success(`${editableLabels[key] || key} updated`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Update failed');
    }
  };

  if (loading) return <LoadingSpinner />;

  const numericKeys = new Set(['opening_balance', 'financial_year_start_month']);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Application configuration" />

      {!isAdmin(user) && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Settings are view-only for your role.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {settings?.map((s) => {
          const isNumeric = numericKeys.has(s.key);
          const isEditable = isAdmin(user) && s.key in editableLabels;
          return (
            <Card key={s.key} title={editableLabels[s.key] || titleCase(s.key)} subtitle={s.description}>
              {isEditable ? (
                <div className="flex items-end gap-2">
                  <Input
                    type={isNumeric ? 'number' : 'text'}
                    step={isNumeric ? '0.01' : undefined}
                    value={drafts[s.key] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                  />
                  <Button variant="secondary" onClick={() => save(s.key)}>
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
    </div>
  );
}