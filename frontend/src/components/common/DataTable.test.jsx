import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './DataTable.jsx';

const columns = [
  { key: 'name', label: 'Name', render: (r) => r.name },
  { key: 'amount', label: 'Amount', render: (r) => String(r.amount) },
];
const rows = [
  { publicId: 'a', name: 'Alice', amount: 10 },
  { publicId: 'b', name: 'Bob', amount: 20 },
];

describe('DataTable', () => {
  it('renders the desktop table without a card renderer', () => {
    render(<DataTable columns={columns} rows={rows} loading={false} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders one mobile card per row plus the desktop table when renderCard is provided', () => {
    const renderCard = vi.fn((r) => <div>{`card:${r.name}`}</div>);
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={rows} loading={false} onRowClick={onRowClick} renderCard={renderCard} />);
    expect(renderCard).toHaveBeenCalledTimes(2);
    expect(screen.getByText('card:Alice')).toBeInTheDocument();
    expect(screen.getByText('card:Bob')).toBeInTheDocument();
    // Desktop table stays intact for md+ widths.
    expect(screen.getByText('Alice', { selector: 'td' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('card:Alice'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('shows loading and empty states', () => {
    const { unmount } = render(<DataTable columns={columns} rows={null} loading />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    unmount();
    render(<DataTable columns={columns} rows={[]} loading={false} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
