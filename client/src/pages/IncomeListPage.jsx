import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as incomeService from '../services/income.service.js';
import * as categoryService from '../services/category.service.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import Pagination from '../components/Pagination.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import { formatCurrency } from '../utils/format.js';

const inputClass =
  'w-full rounded border border-navy/15 bg-white px-3 py-2 font-sans text-navy outline-none transition-colors focus:border-indigo focus:ring-1 focus:ring-indigo';

export default function IncomeListPage() {
  const navigate = useNavigate();
  const [income, setIncome] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  useEffect(() => {
    categoryService
      .listCategories({ type: 'income' })
      .then((r) => setCategories(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, dateFrom, dateTo, page]);

  async function load() {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (category) params.category = category;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    incomeService
      .listIncome(params)
      .then((r) => {
        setIncome(r.items);
        setPagination(r.pagination);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load income.')))
      .finally(() => setLoading(false));
  }

  const activeCount = (category ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const clearFilters = () => {
    setCategory('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy">Other Income</h1>
        <Link
          to="/income/new"
          className="rounded bg-indigo px-4 py-2 font-sans font-medium text-white transition-colors duration-150 hover:bg-indigo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
        >
          Record Income
        </Link>
      </div>

      <div className="mt-4">
        <FilterPanel activeCount={activeCount} onClear={clearFilters}>
          <div className="min-w-[170px]">
            <label htmlFor="inc-category" className="sr-only">
              Filter by category
            </label>
            <select
              id="inc-category"
              className={inputClass}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label htmlFor="inc-from" className="sr-only">
              From date
            </label>
            <input
              id="inc-from"
              type="date"
              className={inputClass}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="min-w-[150px]">
            <label htmlFor="inc-to" className="sr-only">
              To date
            </label>
            <input
              id="inc-to"
              type="date"
              className={inputClass}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </FilterPanel>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load income." message={error} onRetry={load} />
      ) : income.length === 0 ? (
        category || dateFrom || dateTo ? (
          <EmptyState title="No income matches your filters" description="Try adjusting the filters above." />
        ) : (
          <EmptyState
            title="No income recorded"
            description="Record your first income entry to track non-sale earnings."
            actionLabel="Record Income"
            onAction={() => navigate('/income/new')}
          />
        )
      ) : (
        <>
          <div className="mt-4 table-wrap rounded-lg bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-navy/10 font-mono text-xs uppercase tracking-wider text-navy/50">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {income.map((i) => (
                  <tr
                    key={i._id}
                    onClick={() => navigate(`/income/${i._id}`)}
                    className="cursor-pointer border-b border-navy/5 hover:bg-navy/5"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-navy">
                      {i.date ? new Date(i.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 font-sans text-navy">{i.categoryId?.name || '—'}</td>
                    <td className="px-4 py-3 font-sans text-navy/80">{i.description || '—'}</td>
                    <td className="num px-4 py-3 font-mono text-sm text-mint">
                      {formatCurrency(i.amount)}
                    </td>
                    <td className="px-4 py-3 font-sans text-navy/70">{i.reference || '—'}</td>
                    <td className="px-4 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex justify-end gap-3 font-sans text-sm">
                        <Link
                          to={`/income/${i._id}`}
                          className="text-lavender hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
                        >
                          View
                        </Link>
                        <Link
                          to={`/income/${i._id}/edit`}
                          className="text-indigo hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} className="justify-end" />
        </>
      )}
    </section>
  );
}
