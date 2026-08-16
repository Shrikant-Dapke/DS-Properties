import api from '../lib/axios.js';

export async function listLoans(params = {}) {
  const res = await api.get('/loans', { params });
  return res.data.data;
}

export async function getLoan(id) {
  const res = await api.get(`/loans/${id}`);
  return res.data.data;
}

export async function createLoan(payload) {
  const res = await api.post('/loans', payload);
  return res.data.data;
}

export async function updateLoan(id, payload) {
  const res = await api.put(`/loans/${id}`, payload);
  return res.data.data;
}
