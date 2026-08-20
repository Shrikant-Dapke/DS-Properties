import api, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, storeTokens, clearTokens } from './client.js';

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials);
  localStorage.setItem(ACCESS_TOKEN_KEY, data.data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken);
  return data.data.user;
}

export async function logout() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  try {
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } finally {
    clearTokens();
  }
}

export async function changePassword(payload) {
  const { data } = await api.post('/auth/change-password', payload);
  return data.data;
}

export async function restoreSession() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  const { data } = await api.post('/auth/refresh', { refreshToken });
  storeTokens(data.data);
  return data.data.user;
}

export { storeTokens, clearTokens };