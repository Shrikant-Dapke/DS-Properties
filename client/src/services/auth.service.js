import api from '../lib/axios.js';

export async function login(username, password) {
  const res = await api.post('/auth/login', { username, password });
  return res;
}

export async function getMe() {
  const res = await api.get('/auth/me');
  return res;
}
