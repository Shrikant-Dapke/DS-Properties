import api, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearTokens, refreshAccessToken } from './client.js';

const USER_KEY = 'dsp_user';

function decodeExp(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function storeUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials);
  localStorage.setItem(ACCESS_TOKEN_KEY, data.data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken);
  storeUser(data.data.user);
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
    localStorage.removeItem(USER_KEY);
  }
}

export async function changePassword(payload) {
  const { data } = await api.post('/auth/change-password', payload);
  return data.data;
}

export async function restoreSession() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  // Access token still valid and user cached: no network call needed.
  // Avoids burning the auth rate limit on every page load (StrictMode
  // double-mount, multiple tabs, reloads).
  const exp = decodeExp(accessToken || '');
  const storedUser = localStorage.getItem(USER_KEY);
  if (exp && exp > Date.now() + 5000 && storedUser) {
    return JSON.parse(storedUser);
  }

  try {
    // Single-flight: shares the in-flight refresh with the 401 interceptor,
    // so a concurrent restore can never rotate the refresh token twice.
    const data = await refreshAccessToken();
    storeUser(data.user);
    return data.user;
  } catch (err) {
    // Only a genuine 401 (invalid/expired refresh token) ends the session.
    // Transient failures (429/5xx/network) keep tokens so the next load can
    // recover without forcing a re-login.
    if (err?.response?.status === 401) {
      clearTokens();
      localStorage.removeItem(USER_KEY);
    }
    return null;
  }
}

export { clearTokens };
