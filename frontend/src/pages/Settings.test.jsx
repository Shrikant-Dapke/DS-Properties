import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Settings from './Settings.jsx';

vi.mock('../api/endpoints.js', () => ({
  settingsApi: { list: vi.fn(), update: vi.fn() },
}));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { settingsApi } from '../api/endpoints.js';
import { useAuth } from '../hooks/useAuth.js';

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
});
