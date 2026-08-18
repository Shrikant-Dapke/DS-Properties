import api from '../lib/axios.js';

export async function listChangeRequests() {
  const res = await api.get('/change-requests');
  return res.data.data;
}

export async function getChangeRequest(id) {
  const res = await api.get(`/change-requests/${id}`);
  return res.data.data;
}

export async function createChangeRequest(payload) {
  const res = await api.post('/change-requests', payload);
  return res.data.data;
}

export async function approveChangeRequest(id) {
  const res = await api.post(`/change-requests/${id}/approve`);
  return res.data.data;
}

export async function rejectChangeRequest(id, reason) {
  const res = await api.post(`/change-requests/${id}/reject`, { reason });
  return res.data.data;
}

export async function cancelChangeRequest(id) {
  const res = await api.post(`/change-requests/${id}/cancel`);
  return res.data.data;
}

export async function resubmitChangeRequest(id) {
  const res = await api.post(`/change-requests/${id}/resubmit`);
  return res.data.data;
}

export const ENTITY_TYPES = [
  'Plot',
  'Customer',
  'Partner',
  'Category',
  'Expense',
  'Income',
  'Payment',
  'PartnerCapital',
  'LoanReceived',
];

export const OPERATIONS = ['create', 'update', 'delete'];

export const STATUS_BADGE = {
  PENDING: 'lavender',
  APPROVED: 'indigo',
  REJECTED: 'orange',
  CANCELLED: 'navy',
  COMMITTED: 'mint',
};
