import api from '../lib/axios.js';

export async function listExpenses(params = {}) {
  const res = await api.get('/expenses', { params });
  return res.data.data;
}

export async function getExpense(id, { includeDeleted = false } = {}) {
  const res = await api.get(`/expenses/${id}`, {
    params: includeDeleted ? { deleted: 'all' } : {},
  });
  return res.data.data;
}

export async function createExpense(payload) {
  const res = await api.post('/expenses', payload);
  return res.data.data;
}

export async function updateExpense(id, payload) {
  const res = await api.put(`/expenses/${id}`, payload);
  return res.data.data;
}

// Soft delete only — sets deleted = true on the server. Never removes the document.
export async function deleteExpense(id) {
  const res = await api.delete(`/expenses/${id}`);
  return res.data.data;
}
