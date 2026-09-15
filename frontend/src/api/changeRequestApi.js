import api from './client.js';

const get = (url, params) => api.get(url, { params }).then((r) => r.data.data);
const post = (url, body) => api.post(url, body).then((r) => r.data.data);

export const changeRequestApi = {
  list: (params) => get('/change-requests', params),
  get: (publicId) => get(`/change-requests/${publicId}`),
  approve: (publicId, comment) => post(`/change-requests/${publicId}/approve`, { comment }),
  reject: (publicId, comment) => post(`/change-requests/${publicId}/reject`, { comment }),
  bulkApprove: (publicIds) => post('/change-requests/bulk-approve', { publicIds }),
  bulkReject: (publicIds) => post('/change-requests/bulk-reject', { publicIds }),
  cancel: (publicId) => post(`/change-requests/${publicId}/cancel`, {}),
};
