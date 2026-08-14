import api from '../lib/axios.js';

export async function listPayments(params = {}) {
  const res = await api.get('/payments', { params });
  return res.data.data;
}

export async function getPayment(id) {
  const res = await api.get(`/payments/${id}`);
  return res.data.data;
}

export async function createPayment(payload) {
  const res = await api.post('/payments', payload);
  return res.data.data;
}
