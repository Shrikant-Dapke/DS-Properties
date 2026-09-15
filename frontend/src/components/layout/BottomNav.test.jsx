import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from './BottomNav.jsx';

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

import { useAuth } from '../../hooks/useAuth.js';

function renderNav(user, initialEntries = ['/']) {
  useAuth.mockReturnValue({ user, logout: vi.fn() });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('BottomNav (mobile-first)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows exactly five tabs for partners: Dashboard, Add, Transactions, Reports, More', () => {
    renderNav({ username: 'pta', role: 'partner' });
    const nav = screen.getByRole('navigation', { name: 'Mobile nav' });
    const tabs = [...within(nav).getAllByRole('link'), ...within(nav).getAllByRole('button')];
    expect(tabs).toHaveLength(5);
    for (const key of ['nav.dashboard', 'nav.add', 'nav.transactions', 'nav.reports', 'nav.more']) {
      expect(within(nav).getByText(key)).toBeInTheDocument();
    }
    expect(within(nav).queryByText('nav.customers')).not.toBeInTheDocument();
    expect(within(nav).queryByText('nav.settings')).not.toBeInTheDocument();
  });

  it('hides the Add tab for admins (role-gated, like the desktop sidebar)', () => {
    renderNav({ username: 'admin', role: 'admin' });
    const nav = screen.getByRole('navigation', { name: 'Mobile nav' });
    expect(within(nav).queryByText('nav.add')).not.toBeInTheDocument();
    expect(within(nav).getByText('nav.more')).toBeInTheDocument();
  });

  it('More opens a sheet with overflow destinations and logout', () => {
    renderNav({ username: 'pta', role: 'partner' });
    fireEvent.click(screen.getByRole('button', { name: 'nav.more' }));

    const dialog = screen.getByRole('dialog', { name: 'nav.more' });
    for (const key of ['nav.customers', 'nav.partners', 'nav.categories', 'nav.approvals', 'nav.users', 'nav.settings']) {
      expect(within(dialog).getByText(key)).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('link', { name: /nav\.customers/ })).toHaveAttribute('href', '/customers');
    expect(within(dialog).getByText('auth.logout')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'nav.more' })).not.toBeInTheDocument();
  });

  it('More tab highlights while an overflow destination is active', () => {
    renderNav({ username: 'pta', role: 'partner' }, ['/customers']);
    expect(screen.getByRole('button', { name: 'nav.more' }).className).toMatch(/text-emerald-700/);
  });
});
