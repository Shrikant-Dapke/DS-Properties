import api from '../lib/axios.js';

export async function listIncome(params = {}) {
  const res = await api.get('/income', { params });
  return res.data.data;
}

export async function getIncome(id) {
  const res = await api.get(`/income/${id}`);
  return res.data.data;
}

export async function createIncome(payload) {
  const res = await api.post('/income', payload);
  return res.data.data;
}

export async function updateIncome(id, payload) {
  const res = await api.put(`/income/${id}`, payload);
  return res.data.data;
}
