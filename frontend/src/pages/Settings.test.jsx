import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from './Settings.jsx';

vi.mock('../api/endpoints.js', () => ({
  settingsApi: { list: vi.fn(), update: vi.fn() },
  categoryApi: { active: vi.fn(), list: vi.fn() },
  customerApi: { listAll: vi.fn() },
  partnerApi: { listAll: vi.fn() },
  transactionApi: { list: vi.fn() },
  userApi: { list: vi.fn() },
}));

vi.mock('../api/authApi.js', () => ({
  changePassword: vi.fn(),
}));

vi.mock('../utils/excel.js', () => ({
  exportTableToExcel: vi.fn(),
}));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { settingsApi, categoryApi } from '../api/endpoints.js';
import { useAuth } from '../hooks/useAuth.js';
import { exportTableToExcel } from '../utils/excel.js';

const ROWS = [
  {
    key: 'company_name',
    value: 'DS Properties',
    description: 'Business/company display name',
    updatedAt: '2026-09-13T00:00:00.000Z',
    updatedBy: 'admin',
  },
  {
    key: 'opening_balance',
    value: 0,
    description: 'Opening cash balance at system start',
    updatedAt: '2026-09-13T00:00:00.000Z',
    updatedBy: null,
  },
];

describe('Settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    categoryApi.active.mockResolvedValue([]);
  });

  it('shows an explicit empty state instead of a blank page when no settings exist', async () => {
    useAuth.mockReturnValue({ user: { username: 'admin', role: 'admin' } });
    settingsApi.list.mockResolvedValue([]);
    render(<Settings />);
    expect(await screen.findByText('No configuration values yet')).toBeInTheDocument();
  });

  it('renders setting cards with values for every role', async () => {
    useAuth.mockReturnValue({ user: { username: 'admin', role: 'admin' } });
    settingsApi.list.mockResolvedValue(ROWS);
    render(<Settings />);
    expect(await screen.findByText('Company name')).toBeInTheDocument();
    expect(screen.getByText('Opening balance (₹)')).toBeInTheDocument();
    expect(screen.getByText('DS Properties')).toBeInTheDocument();
  });

  it('keeps admins view-only while partners can edit', async () => {
    settingsApi.list.mockResolvedValue(ROWS);

    useAuth.mockReturnValue({ user: { username: 'admin', role: 'admin' } });
    const { unmount } = render(<Settings />);
    await screen.findByText('Company name');
    expect(screen.getByText(/view-only for your role/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    unmount();

    useAuth.mockReturnValue({ user: { username: 'pta', role: 'partner' } });
    render(<Settings />);
    await screen.findByText('Company name');
    expect(screen.queryByText(/view-only for your role/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^save$/i })).toHaveLength(2);
  });

  it('renders section navigation for business, categories, users, security and backup', async () => {
    useAuth.mockReturnValue({ user: { username: 'admin', role: 'admin' } });
    settingsApi.list.mockResolvedValue(ROWS);
    render(<Settings />);
    await screen.findByText('Company name');
    for (const label of ['Business', 'Categories', 'Users', 'Security', 'Backup']) {
      expect(screen.getByText(label, { selector: 'span' })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /manage categories/i })).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('link', { name: /manage users/i })).toHaveAttribute('href', '/users');
  });

  it('opens the secure change-password flow from the security section', async () => {
    useAuth.mockReturnValue({ user: { username: 'admin', role: 'admin' } });
    settingsApi.list.mockResolvedValue(ROWS);
    render(<Settings />);
    await screen.findByText('Company name');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByText('Current password')).toBeInTheDocument();
  });

  it('exports a full Excel backup assembled from the existing read APIs', async () => {
    const { transactionApi, customerApi, partnerApi, userApi } = await import('../api/endpoints.js');
    useAuth.mockReturnValue({ user: { username: 'admin', role: 'admin' } });
    settingsApi.list.mockResolvedValue(ROWS);
    transactionApi.list.mockResolvedValue({ rows: [], pagination: {} });
    customerApi.listAll.mockResolvedValue([]);
    partnerApi.listAll.mockResolvedValue([]);
    userApi.list.mockResolvedValue({ rows: [] });
    categoryApi.list.mockResolvedValue({ rows: [] });
    exportTableToExcel.mockResolvedValue(undefined);

    render(<Settings />);
    await screen.findByText('Company name');
    fireEvent.click(screen.getByRole('button', { name: /export excel/i }));

    await waitFor(() => expect(exportTableToExcel).toHaveBeenCalledTimes(1));
    const payload = exportTableToExcel.mock.calls[0][0];
    expect(payload.sheets.map((s) => s.name)).toEqual(
      expect.arrayContaining(['Transactions', 'Customers', 'Partners', 'Categories', 'Users', 'Settings']),
    );
  });
});
