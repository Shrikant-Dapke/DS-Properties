import api from '../lib/axios.js';

export async function listReportTypes() {
  const res = await api.get('/reports/types');
  return res.data.data.types;
}

export async function generateReport(type, params = {}) {
  const res = await api.get(`/reports/${type}`, { params });
  return res.data.data;
}

export async function downloadReport(type, params = {}, format) {
  const res = await api.get(`/reports/${type}/export`, {
    params: { ...params, format },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : `${type}-report.${format}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
