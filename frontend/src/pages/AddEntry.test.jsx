import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AddEntry from './AddEntry.jsx';

vi.mock('../api/endpoints.js', () => ({
  customerApi: { list: vi.fn().mockResolvedValue({ rows: [{ publicId: 'cust-1', name: 'Anil' }] }) },
  partnerApi: { list: vi.fn().mockResolvedValue({ rows: [] }) },
  categoryApi: { active: vi.fn().mockResolvedValue([{ publicId: 'cat-1', name: 'Labor' }]) },
  transactionApi: { create: vi.fn(), update: vi.fn(), get: vi.fn() },
}));

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { transactionApi } from '../api/endpoints.js';

const renderAddEntry = () =>
  render(
    <MemoryRouter initialEntries={['/entries/new']}>
      <Routes>
        <Route path="/entries/new" element={<AddEntry />} />
        <Route path="/transactions" element={<div>transactions page</div>} />
      </Routes>
    </MemoryRouter>
  );

async function fillValidOuttake(user) {
  await user.click(screen.getByRole('button', { name: /outtake/i }));
  await user.type(screen.getByLabelText(/amount/i), '5000');
  await user.selectOptions(screen.getByLabelText(/payment mode/i), 'cash');
  await user.selectOptions(screen.getByLabelText(/expense category/i), 'cat-1');
  await user.type(screen.getByLabelText(/paid to/i), 'Contractor');
  await user.type(screen.getByLabelText(/description/i), 'Site work');
}

describe('AddEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears intake source state when switching to outtake and sends no source fields', async () => {
    const user = userEvent.setup();
    renderAddEntry();

    const sourceSelect = screen.getByLabelText(/^source$/i);
    await user.selectOptions(sourceSelect, 'customer');
    expect(screen.getByLabelText(/^customer$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /outtake/i }));
    expect(screen.queryByLabelText(/^source$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^customer$/i)).not.toBeInTheDocument();

    await fillValidOuttake(user);
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(transactionApi.create).toHaveBeenCalledTimes(1);
    const payload = transactionApi.create.mock.calls[0][0];
    expect(payload).not.toHaveProperty('sourceType');
    expect(payload).not.toHaveProperty('customerPublicId');
    expect(payload).not.toHaveProperty('partnerPublicId');
    expect(payload.transactionType).toBe('outtake');
    expect(payload.categoryPublicId).toBe('cat-1');
    expect(payload.paidTo).toBe('Contractor');
  });

  it('shows the duplicate warning dialog without navigating, and only leaves on Continue', async () => {
    transactionApi.create.mockResolvedValue({ duplicateWarning: true, duplicates: [{ publicId: 'x' }] });
    const user = userEvent.setup();
    renderAddEntry();

    await fillValidOuttake(user);
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    const dialog = await screen.findByText(/possible duplicate entry/i);
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByText('transactions page')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /stay here/i }));
    expect(screen.queryByText(/possible duplicate entry/i)).not.toBeInTheDocument();
    expect(screen.queryByText('transactions page')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save entry/i }));
    await screen.findByText(/possible duplicate entry/i);
    await user.click(screen.getByRole('button', { name: /continue to transactions/i }));
    expect(await screen.findByText('transactions page')).toBeInTheDocument();
  });
});