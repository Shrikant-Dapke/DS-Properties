import api from '../lib/axios.js';

export async function listPartners(params = {}) {
  const res = await api.get('/partners', { params });
  return res.data.data;
}

export async function getPartner(id) {
  const res = await api.get(`/partners/${id}`);
  return res.data.data;
}

export async function createPartner(payload) {
  const res = await api.post('/partners', payload);
  return res.data.data;
}

export async function updatePartner(id, payload) {
  const res = await api.put(`/partners/${id}`, payload);
  return res.data.data;
}

export async function deletePartner(id) {
  const res = await api.delete(`/partners/${id}`);
  return res.data;
}

export async function getPartnerCapitalSummary(id) {
  const res = await api.get(`/partners/${id}/capital-summary`);
  return res.data.data;
}
