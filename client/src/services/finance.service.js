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
