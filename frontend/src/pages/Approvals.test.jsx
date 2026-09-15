import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Approvals from './Approvals.jsx';

vi.mock('../api/changeRequestApi.js', () => ({
  changeRequestApi: { list: vi.fn(), approve: vi.fn(), reject: vi.fn() },
}));

vi.mock('../api/endpoints.js', () => ({
  userApi: { list: vi.fn().mockResolvedValue({ rows: [] }) },
}));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useTranslation: () => ({ t: (key) => key }) };
});

import { changeRequestApi } from '../api/changeRequestApi.js';
import { userApi } from '../api/endpoints.js';
import { useAuth } from '../hooks/useAuth.js';

function crRow(overrides = {}) {
  return {
    publicId: 'cr-1',
    entityType: 'customer',
    operation: 'create',
    status: 'PENDING',
    requestedBy: 3,
    requiredApprovers: [4, 5],
    approvals: [],
    proposedState: { name: 'Acme' },
    createdAt: '2026-09-13T00:00:00.000Z',
    viewerCanDecide: false,
    viewerDecision: null,
    ...overrides,
  };
}

function renderAs(user) {
  useAuth.mockReturnValue({ user });
  return render(<Approvals />);
}

describe('Approvals decision visibility (server-derived)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requester sees Details only plus a Your-request marker, never Approve/Reject', async () => {
    changeRequestApi.list.mockResolvedValue({ rows: [crRow()], pagination: {} });
    renderAs({ id: 3, username: 'pta', role: 'partner' });

    const row = (await screen.findByText('#3')).closest('tr');
    expect(within(row).getByRole('button', { name: /common.details/i })).toBeInTheDocument();
    expect(screen.getByText('approvals.yourRequest')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /approvals.approve/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /approvals.reject/i })).not.toBeInTheDocument();
  });

  it('required approver sees Details + Approve + Reject', async () => {
    changeRequestApi.list.mockResolvedValue({
      rows: [crRow({ viewerCanDecide: true })],
      pagination: {},
    });
    renderAs({ id: 4, username: 'ptb', role: 'partner' });

    const row = (await screen.findByText('#3')).closest('tr');
    expect(within(row).getByRole('button', { name: /common.details/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /approvals.approve/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /approvals.reject/i })).toBeInTheDocument();
    expect(within(row).queryByText('approvals.yourRequest')).not.toBeInTheDocument();
  });

  it('non-member partner sees Details only', async () => {
    changeRequestApi.list.mockResolvedValue({ rows: [crRow()], pagination: {} });
    renderAs({ id: 9, username: 'stranger', role: 'partner' });

    const row = (await screen.findByText('#3')).closest('tr');
    expect(within(row).getByRole('button', { name: /common.details/i })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /approvals.approve/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /approvals.reject/i })).not.toBeInTheDocument();
  });

  it('admin sees Details only (never Partner approval controls)', async () => {
    changeRequestApi.list.mockResolvedValue({ rows: [crRow()], pagination: {} });
    renderAs({ id: 1, username: 'admin', role: 'admin' });

    const row = (await screen.findByText('#3')).closest('tr');
    expect(within(row).getByRole('button', { name: /common.details/i })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /approvals.approve/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /approvals.reject/i })).not.toBeInTheDocument();
  });

  it('approver who already decided sees a decided marker instead of buttons', async () => {
    changeRequestApi.list.mockResolvedValue({
      rows: [
        crRow({
          viewerCanDecide: false,
          viewerDecision: 'APPROVED',
          approvals: [{ id: 7, adminUserId: 4, status: 'APPROVED', comment: null, decidedAt: '2026-09-13T01:00:00.000Z' }],
        }),
      ],
      pagination: {},
    });
    renderAs({ id: 4, username: 'ptb', role: 'partner' });

    const row = (await screen.findByText('#3')).closest('tr');
    expect(within(row).queryByRole('button', { name: /approvals.approve/i })).not.toBeInTheDocument();
    expect(screen.getByText('approvals.decidedByYou')).toBeInTheDocument();
  });

  it('partner-governed user request: eligible partner decides, admin is view-only', async () => {
    // The server always sends an explicit viewerCanDecide; explicit false
    // beats the legacy client fallback, so mirror real payloads here.
    const userRequest = (viewerCanDecide) =>
      crRow({ entityType: 'user', operation: 'create', viewerCanDecide });

    // Eligible partner reviewer gets controls.
    changeRequestApi.list.mockResolvedValue({ rows: [userRequest(true)], pagination: {} });
    const { unmount } = renderAs({ id: 4, username: 'ptb', role: 'partner' });
    const row = (await screen.findByText('#3')).closest('tr');
    expect(within(row).getByRole('button', { name: /approvals.approve/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /approvals.reject/i })).toBeInTheDocument();
    unmount();

    // Same request, admin viewer without decision power: Details only.
    changeRequestApi.list.mockResolvedValue({ rows: [userRequest(false)], pagination: {} });
    renderAs({ id: 1, username: 'admin', role: 'admin' });
    const adminRow = (await screen.findByText('#3')).closest('tr');
    expect(within(adminRow).getByRole('button', { name: /common.details/i })).toBeInTheDocument();
    expect(within(adminRow).queryByRole('button', { name: /approvals.approve/i })).not.toBeInTheDocument();
    expect(within(adminRow).queryByRole('button', { name: /approvals.reject/i })).not.toBeInTheDocument();
  });

  it('server-driven requester flag marks the requester row even with a mismatched cached user', async () => {
    // The label follows the server flag, not the locally cached user id: a
    // stale/incorrect local identity can never mislabel or leak controls.
    changeRequestApi.list.mockResolvedValue({
      rows: [crRow({ viewerIsRequester: true, viewerCanDecide: false })],
      pagination: {},
    });
    renderAs({ id: 99, username: 'someone-else', role: 'partner' });
    const row = (await screen.findByText('#3')).closest('tr');
    expect(screen.getByText('approvals.yourRequest')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /approvals.approve/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /approvals.reject/i })).not.toBeInTheDocument();
  });

  it('requester and approver names resolve from the user directory', async () => {
    userApi.list.mockResolvedValue({ rows: [{ id: 3, username: 'dattatraya' }] });
    changeRequestApi.list.mockResolvedValue({ rows: [crRow()], pagination: {} });
    renderAs({ id: 9, username: 'stranger', role: 'partner' });
    const row = (await screen.findByText('dattatraya')).closest('tr');
    expect(within(row).queryByText('#3')).not.toBeInTheDocument();
  });
});
