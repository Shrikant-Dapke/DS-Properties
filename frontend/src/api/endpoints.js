import api from './client.js';

const get = (url, params) => api.get(url, { params }).then((r) => r.data.data);
const post = (url, body) => api.post(url, body).then((r) => r.data.data);
const put = (url, body) => api.put(url, body).then((r) => r.data.data);
const del = (url, body) => api.delete(url, { data: body }).then((r) => r.data.data);

export const dashboardApi = {
  summary: () => get('/dashboard/summary'),
  categoryBreakdown: () => get('/dashboard/categories'),
};

export const customerApi = {
  list: (params) => get('/customers', params),
  get: (publicId) => get(`/customers/${publicId}`),
  create: (body) => post('/customers', body),
  update: (publicId, body) => put(`/customers/${publicId}`, body),
  remove: (publicId) => del(`/customers/${publicId}`),
  ledger: (publicId, params) => get(`/customers/${publicId}/ledger`, params),
};

export const partnerApi = {
  list: (params) => get('/partners', params),
  get: (publicId) => get(`/partners/${publicId}`),
  create: (body) => post('/partners', body),
  update: (publicId, body) => put(`/partners/${publicId}`, body),
  remove: (publicId) => del(`/partners/${publicId}`),
  ledger: (publicId, params) => get(`/partners/${publicId}/ledger`, params),
};

export const categoryApi = {
  list: (params) => get('/categories', params),
  active: () => get('/categories/active'),
  create: (body) => post('/categories', body),
  update: (publicId, body) => put(`/categories/${publicId}`, body),
  remove: (publicId) => del(`/categories/${publicId}`),
};

export const transactionApi = {
  list: (params) => get('/transactions', params),
  get: (publicId) => get(`/transactions/${publicId}`),
  create: (body) => post('/transactions', body),
  remove: (publicId, body) => del(`/transactions/${publicId}`, body),
  reverse: (publicId, body) => post(`/transactions/${publicId}/reverse`, body),
};

export const reportApi = {
  daily: (params) => get('/reports/daily', params),
  monthly: (params) => get('/reports/monthly', params),
  categories: (params) => get('/reports/categories', params),
  partner: (publicId, params) => get(`/reports/partners/${publicId}`, params),
};

export const settingsApi = {
  list: () => get('/settings'),
  update: (key, value) => put(`/settings/${key}`, { value }),
};

export const userApi = {
  list: (params) => get('/users', params),
  create: (body) => post('/users', body),
  update: (publicId, body) => put(`/users/${publicId}`, body),
  setActive: (publicId, isActive) => api.patch(`/users/${publicId}/active`, { isActive }).then((r) => r.data.data),
  resetPassword: (publicId, newPassword) => post(`/users/${publicId}/reset-password`, { newPassword }),
  remove: (publicId) => del(`/users/${publicId}`),
};

export const auditApi = {
  list: (params) => get('/audit', params),
};