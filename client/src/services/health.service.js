import api from '../lib/axios.js';

export async function getHealth() {
  const res = await api.get('/health');
  return res.data;
}
