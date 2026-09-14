import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Users from './Users.jsx';

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('../api/endpoints.js', () => ({
  userApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setActive: vi.fn(),
    resetPassword: vi.fn(),
    remove: vi.fn(),
  },
  partnerApi: { listAll: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

import { userApi, partnerApi } from '../api/endpoints.js';
import { useAuth } from '../hooks/useAuth.js';

// Inputs carry no id/htmlFor pairing, so locate them via their label wrapper.
function inputFor(labelText) {
  return screen.getByText(labelText).closest('div').querySelector('input');
}

function selectFor(labelText) {
  return screen.getByText(labelText).closest('div').querySelector('select');
}

async function openAddUser() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /add user/i }));
  await screen.findByText('Username *');
  return user;
}

function renderAsAdmin() {
  useAuth.mockReturnValue({ user: { username: 'admin', role: 'admin' } });
  userApi.list.mockResolvedValue({ rows: [] });
  partnerApi.listAll.mockResolvedValue([{ publicId: 'p-1', name: 'Existing Partner' }]);
  return render(<Users />);
}

describe('Users Add-user partner onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the existing-partner select plus a create toggle, no inline fields initially', async () => {
    renderAsAdmin();
    await openAddUser();
    expect(screen.getByText('Partner record *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new partner/i })).toBeInTheDocument();
    expect(screen.queryByText('Partner name *')).not.toBeInTheDocument();
  });

  it('create mode requires the partner name and makes no API call without it', async () => {
    renderAsAdmin();
    const user = await openAddUser();
    await user.click(screen.getByRole('button', { name: /create new partner/i }));
    expect(screen.getByText('Partner name *')).toBeInTheDocument();

    await user.type(inputFor('Username *'), 'newbie');
    await user.type(inputFor('Full name *'), 'New Bie');
    await user.type(inputFor('Password *'), 'Secret@123');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(userApi.create).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/partner name/i));
  });

  it('create mode submits one atomic payload and refreshes the partner directory', async () => {
    renderAsAdmin();
    const user = await openAddUser();
    await user.click(screen.getByRole('button', { name: /create new partner/i }));

    await user.type(inputFor('Username *'), 'partnerb');
    await user.type(inputFor('Full name *'), 'Partner B');
    await user.type(inputFor('Password *'), 'Secret@123');
    await user.type(inputFor('Partner name *'), 'B Business');
    await user.type(inputFor('Phone'), '9999999999');
    userApi.create.mockResolvedValue({});

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(userApi.create).toHaveBeenCalledTimes(1));
    const payload = userApi.create.mock.calls[0][0];
    expect(payload.role).toBe('partner');
    expect(payload.partnerPublicId).toBeUndefined();
    expect(payload.newPartner).toMatchObject({ name: 'B Business', phone: '9999999999' });
    // Directory refresh so the new record is selectable afterwards.
    await waitFor(() => expect(partnerApi.listAll).toHaveBeenCalledTimes(2));
    // Modal closes on success.
    await waitFor(() => expect(screen.queryByText('Partner name *')).not.toBeInTheDocument());
  });

  it('cancelling the nested create flow keeps the entered user data', async () => {
    renderAsAdmin();
    const user = await openAddUser();
    await user.type(inputFor('Username *'), 'keepme');
    await user.click(screen.getByRole('button', { name: /create new partner/i }));
    await user.type(inputFor('Partner name *'), 'Draft Partner');
    await user.click(screen.getByRole('button', { name: /use existing instead/i }));

    expect(inputFor('Username *').value).toBe('keepme');
    expect(screen.getByText('Partner record *')).toBeInTheDocument();
    expect(screen.queryByText('Partner name *')).not.toBeInTheDocument();
  });

  it('non-partner roles see no partner UI and send no partner keys', async () => {
    renderAsAdmin();
    const user = await openAddUser();
    await user.selectOptions(selectFor('Role *'), 'admin');

    expect(screen.queryByText('Partner record *')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create new partner/i })).not.toBeInTheDocument();

    await user.type(inputFor('Username *'), 'plainadmin');
    await user.type(inputFor('Full name *'), 'Plain Admin');
    await user.type(inputFor('Password *'), 'Secret@123');
    userApi.create.mockResolvedValue({});

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(userApi.create).toHaveBeenCalledTimes(1));
    const payload = userApi.create.mock.calls[0][0];
    expect(payload.role).toBe('admin');
    expect(payload.partnerPublicId).toBeUndefined();
    expect(payload.newPartner).toBeUndefined();
  });
});
