import api from '../lib/axios.js';

export async function listCategories(params = {}) {
  const r = await api.get('/categories', { params });
  return r.data.data;
}

export async function getCategory(id) {
  const r = await api.get(`/categories/${id}`);
  return r.data.data;
}

export async function createCategory(payload) {
  const r = await api.post('/categories', payload);
  return r.data.data;
}

export async function updateCategory(id, payload) {
  const r = await api.put(`/categories/${id}`, payload);
  return r.data.data;
}

export async function deleteCategory(id) {
  const r = await api.delete(`/categories/${id}`);
  return r.data;
}
