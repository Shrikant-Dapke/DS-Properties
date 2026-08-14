import api from '../lib/axios.js';

export async function listCustomers(params = {}) {
  const res = await api.get('/customers', { params });
  return res.data.data;
}

export async function getCustomer(id) {
  const res = await api.get(`/customers/${id}`);
  return res.data.data;
}

export async function createCustomer(payload) {
  const res = await api.post('/customers', payload);
  return res.data.data;
}

export async function updateCustomer(id, payload) {
  const res = await api.put(`/customers/${id}`, payload);
  return res.data.data;
}

export async function deleteCustomer(id) {
  const res = await api.delete(`/customers/${id}`);
  return res.data;
}
