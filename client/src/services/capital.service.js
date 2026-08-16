import api from '../lib/axios.js';

export async function listCapital(params = {}) {
  const res = await api.get('/capital', { params });
  return res.data.data;
}

export async function getCapital(id) {
  const res = await api.get(`/capital/${id}`);
  return res.data.data;
}

export async function createCapital(payload) {
  const res = await api.post('/capital', payload);
  return res.data.data;
}

export async function updateCapital(id, payload) {
  const res = await api.put(`/capital/${id}`, payload);
  return res.data.data;
}
