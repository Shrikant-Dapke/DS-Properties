import api from '../lib/axios.js';

export async function getDashboardSummary(params = {}) {
  const res = await api.get('/dashboard/summary', { params });
  return res.data.data;
}

export async function getDashboardTrends(params = {}) {
  const res = await api.get('/dashboard/trends', { params });
  return res.data.data;
}

export async function getDashboardRecent(params = {}) {
  const res = await api.get('/dashboard/recent', { params });
  return res.data.data;
}
