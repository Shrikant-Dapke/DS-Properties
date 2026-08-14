import api from '../lib/axios.js';

export async function listPlots(params = {}) {
  const res = await api.get('/plots', { params });
  return res.data.data;
}

export async function getPlot(id) {
  const res = await api.get(`/plots/${id}`);
  return res.data.data;
}

export async function createPlot(payload) {
  const res = await api.post('/plots', payload);
  return res.data.data;
}

export async function updatePlot(id, payload) {
  const res = await api.put(`/plots/${id}`, payload);
  return res.data.data;
}

export async function deletePlot(id) {
  const res = await api.delete(`/plots/${id}`);
  return res.data;
}
