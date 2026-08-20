import { useEffect, useState } from 'react';
import { auditApi } from '../api/endpoints.js';
import { useToast } from '../hooks/useToast.js';
import { Input } from '../components/common/Input.jsx';
import { Select } from '../components/common/Select.jsx';
import { Button } from '../components/common/Button.jsx';
import { Card } from '../components/common/Card.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { formatDateTime, titleCase } from '../utils/formatters.js';

const domains = ['auth', 'users', 'customers', 'partners', 'categories', 'transactions', 'reports', 'app_settings'];

export default function Audit() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ domain: '', action: '' });
  const [loading, setLoading] = useState(true);

  const load = async (p = page, f = filters) => {
    setLoading(true);
    try {
      const data = await auditApi.list({
        page: p,
        pageSize: 30,
        domain: f.domain || undefined,
        action: f.action || undefined,
      });
      setRows(data.rows || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, filters);
  };

  const columns = [
    { key: 'created_at', label: 'Time', render: (r) => formatDateTime(r.created_at) },
    { key: 'user_username', label: 'User', render: (r) => r.user_username || 'system' },
    {
      key: 'domain',
      label: 'Domain',
      render: (r) => <Badge tone="blue">{titleCase(r.domain)}</Badge>,
    },
    { key: 'action', label: 'Action', render: (r) => titleCase(r.action) },
    { key: 'record_id', label: 'Record', render: (r) => r.record_id || '—' },
    {
      key: 'changes',
      label: 'Changes',
      render: (r) => {
        const changed = [];
        if (r.new_values) {
          const parsed = typeof r.new_values === 'string' ? JSON.parse(r.new_values) : r.new_values;
          changed.push(...Object.keys(parsed));
        }
        if (r.old_values) {
          const parsed = typeof r.old_values === 'string' ? JSON.parse(r.old_values) : r.old_values;
          for (const k of Object.keys(parsed)) {
            if (!changed.includes(k)) changed.push(k);
          }
        }
        return changed.length > 0 ? changed.join(', ') : '—';
      },
    },
    { key: 'ip_address', label: 'IP', render: (r) => r.ip_address || '—' },
  ];

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every meaningful action, recorded" />

      <Card className="mb-4" pad={false}>
        <form onSubmit={apply} className="flex flex-wrap items-end gap-3 p-4">
          <Select
            label="Domain"
            value={filters.domain}
            onChange={(e) => setFilters((f) => ({ ...f, domain: e.target.value }))}
            className="w-44"
          >
            <option value="">All</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {titleCase(d)}
              </option>
            ))}
          </Select>
          <Input
            label="Action"
            placeholder="e.g. login, create"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            className="w-48"
          />
          <Button type="submit">Filter</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFilters({ domain: '', action: '' });
              setPage(1);
              load(1, { domain: '', action: '' });
            }}
          >
            Reset
          </Button>
        </form>
      </Card>

      <Card pad={false}>
        <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No audit entries match." />
        <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); load(p); }} />
      </Card>
    </div>
  );
}