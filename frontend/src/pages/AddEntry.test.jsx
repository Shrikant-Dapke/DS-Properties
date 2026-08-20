import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AddEntry from './AddEntry.jsx';

vi.mock('../api/endpoints.js', () => ({
  customerApi: { list: vi.fn(), listAll: vi.fn().mockResolvedValue([]) },
  partnerApi: { list: vi.fn(), listAll: vi.fn().mockResolvedValue([]) },
  categoryApi: { active: vi.fn().mockResolvedValue([{ publicId: 'cat-1', name: 'Labor' }]) },
  transactionApi: { create: vi.fn(), update: vi.fn(), get: vi.fn() },
}));

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { customerApi, partnerApi, transactionApi } from '../api/endpoints.js';

const CUSTOMERS = [{ publicId: 'cust-1', name: 'Anil', phone: '9876543210' }];
const PARTNERS = [{ publicId: 'p-1', name: 'Ramesh', phone: '9988776655' }];

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

  it('loads existing customers into the selector and submits the customer id', async () => {
    customerApi.listAll.mockResolvedValue(CUSTOMERS);
    const user = userEvent.setup();
    renderAddEntry();

    const select = await screen.findByLabelText(/^customer$/i);
    expect(within(select).getByRole('option', { name: /Anil/ })).toBeInTheDocument();

    await user.selectOptions(select, 'cust-1');
    await user.type(screen.getByLabelText(/amount/i), '12000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(transactionApi.create).toHaveBeenCalledTimes(1);
    const payload = transactionApi.create.mock.calls[0][0];
    expect(payload.transactionType).toBe('intake');
    expect(payload.sourceType).toBe('customer');
    expect(payload.customerPublicId).toBe('cust-1');
    expect(payload).not.toHaveProperty('partnerPublicId');
  });

  it('renders partners and submits the correct payload for Partner Capital', async () => {
    partnerApi.listAll.mockResolvedValue(PARTNERS);
    const user = userEvent.setup();
    renderAddEntry();

    await user.selectOptions(screen.getByLabelText(/^source$/i), 'partner_capital');
    const select = await screen.findByLabelText(/^partner$/i);
    expect(screen.queryByLabelText(/^customer$/i)).not.toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /Ramesh/ })).toBeInTheDocument();

    await user.selectOptions(select, 'p-1');
    await user.type(screen.getByLabelText(/amount/i), '50000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(transactionApi.create).toHaveBeenCalledTimes(1);
    const payload = transactionApi.create.mock.calls[0][0];
    expect(payload.sourceType).toBe('partner_capital');
    expect(payload.partnerPublicId).toBe('p-1');
    expect(payload).not.toHaveProperty('customerPublicId');
  });

  it('renders partners and submits the correct payload for Partner Loan', async () => {
    partnerApi.listAll.mockResolvedValue(PARTNERS);
    const user = userEvent.setup();
    renderAddEntry();

    await user.selectOptions(screen.getByLabelText(/^source$/i), 'partner_loan');
    const select = await screen.findByLabelText(/^partner$/i);
    expect(screen.queryByLabelText(/^customer$/i)).not.toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /Ramesh/ })).toBeInTheDocument();

    await user.selectOptions(select, 'p-1');
    await user.type(screen.getByLabelText(/amount/i), '30000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(transactionApi.create).toHaveBeenCalledTimes(1);
    const payload = transactionApi.create.mock.calls[0][0];
    expect(payload.sourceType).toBe('partner_loan');
    expect(payload.partnerPublicId).toBe('p-1');
    expect(payload).not.toHaveProperty('customerPublicId');
  });

  it('switches selectors correctly across sources and outtake', async () => {
    customerApi.listAll.mockResolvedValue(CUSTOMERS);
    partnerApi.listAll.mockResolvedValue(PARTNERS);
    const user = userEvent.setup();
    renderAddEntry();

    await screen.findByLabelText(/^customer$/i);
    await user.selectOptions(screen.getByLabelText(/^source$/i), 'partner_capital');
    await screen.findByLabelText(/^partner$/i);
    expect(screen.queryByLabelText(/^customer$/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^source$/i), 'partner_loan');
    await screen.findByLabelText(/^partner$/i);
    expect(screen.queryByLabelText(/^customer$/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^source$/i), 'customer');
    await screen.findByLabelText(/^customer$/i);
    expect(screen.queryByLabelText(/^partner$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /outtake/i }));
    expect(screen.queryByLabelText(/^source$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^customer$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^partner$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/expense category/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /intake/i }));
    expect(await screen.findByLabelText(/^customer$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/expense category/i)).not.toBeInTheDocument();
  });

  it('shows an explicit error state when the customer API fails, and recovers on Retry', async () => {
    customerApi.listAll.mockRejectedValueOnce(new Error('network down')).mockResolvedValue(CUSTOMERS);
    const user = userEvent.setup();
    renderAddEntry();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not load customers/i);
    expect(screen.queryByText(/no customers yet/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));
    const select = await screen.findByLabelText(/^customer$/i);
    expect(within(select).getByRole('option', { name: /Anil/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an empty state (distinct from an API failure) when no customers exist', async () => {
    customerApi.listAll.mockResolvedValue([]);
    renderAddEntry();

    expect(await screen.findByText(/no customers yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

  it('prefills edit mode from an existing transaction (customer)', async () => {
    transactionApi.get.mockResolvedValue({
      publicId: 'tx-9',
      transactionType: 'intake',
      sourceType: 'customer',
      customer: { publicId: 'cust-1', name: 'Anil' },
      amount: '42000',
      paymentMode: 'cheque',
      transactionDate: '2026-08-01',
    });
    customerApi.listAll.mockResolvedValue(CUSTOMERS);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/entries/new?edit=tx-9']}>
        <Routes>
          <Route path="/entries/new" element={<AddEntry />} />
          <Route path="/transactions" element={<div>transactions page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const select = await screen.findByLabelText(/^customer$/i);
    expect(within(select).getByRole('option', { name: /Anil/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /update entry/i })).toBeInTheDocument();

    await user.selectOptions(select, 'cust-1');
    await user.click(screen.getByRole('button', { name: /update entry/i }));
    expect(transactionApi.update).toHaveBeenCalledWith('tx-9', expect.objectContaining({ customerPublicId: 'cust-1' }));
  });
});