import api from '../lib/axios.js';

export async function listTransactions(params = {}) {
  const res = await api.get('/finance/transactions', { params });
  return res.data.data;
}

export async function getFinanceSummary() {
  const res = await api.get('/finance/summary');
  return res.data.data;
}

export const SOURCE_LABELS = {
  payment: 'Payment',
  income: 'Income',
  expense: 'Expense',
  capital: 'Partner Capital',
  loan: 'Loan',
};

export const FINANCE_TABS = [
  { value: 'all', label: 'All Transactions' },
  { value: 'in', label: 'Money In' },
  { value: 'out', label: 'Money Out' },
];
