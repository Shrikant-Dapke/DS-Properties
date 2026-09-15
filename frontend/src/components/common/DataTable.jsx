import { EmptyState } from './EmptyState.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';

// Responsive table: on desktop (md+) renders the table; on mobile renders
// one card per row via renderCard when provided (otherwise the table scrolls
// horizontally inside its own container). Card renderers should return a
// block with their own padding (px-4 py-3) and full-width action rows.
export function DataTable({ columns, rows, loading, onRowClick, emptyTitle = 'No records', emptyMessage, renderCard }) {
  if (loading) return <LoadingSpinner />;
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }
  const keyOf = (row, i) => row.__key ?? row.publicId ?? row.public_id ?? row.id ?? i;
  const table = (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          {columns.map((col) => (
            <th key={col.key} className={`px-4 py-2.5 font-semibold ${col.align === 'right' ? 'text-right' : ''}`}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr
            key={keyOf(row, i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors`}
          >
            {columns.map((col) => (
              <td key={col.key} className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''}`}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (!renderCard) {
    return <div className="overflow-x-auto">{table}</div>;
  }
  return (
    <>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row, i) => (
          <li
            key={keyOf(row, i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'cursor-pointer transition-colors hover:bg-slate-50' : ''}
          >
            {renderCard(row)}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">{table}</div>
    </>
  );
}
