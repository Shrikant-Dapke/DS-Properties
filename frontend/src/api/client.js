import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE || '/api/v1';

export const ACCESS_TOKEN_KEY = 'dsp_access_token';
export const REFRESH_TOKEN_KEY = 'dsp_refresh_token';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let refreshQueue = [];
let refreshPromise = null;

function getTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function storeTokens({ accessToken, refreshToken }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export { storeTokens };

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function performRefresh(refreshToken) {
  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
  storeTokens(data.data);
  return data.data;
}

// Single-flight refresh: concurrent callers (401 interceptor, session restore,
// multiple tabs) share one in-flight refresh so the refresh token is never
// rotated twice with the same value (which the server treats as reuse).
export function refreshAccessToken() {
  const { refreshToken } = getTokens();
  if (!refreshToken) return Promise.reject(new Error('no refresh token'));
  if (!refreshPromise) {
    refreshPromise = performRefresh(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const { accessToken } = getTokens();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const { response } = error;

    if (response?.status === 401 && !original._retry && !original.url.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject, config: original });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const data = await refreshAccessToken();
        refreshQueue.forEach(({ resolve, config }) => {
          config.headers.Authorization = `Bearer ${data.accessToken}`;
          resolve(api(config));
        });
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        refreshQueue.forEach(({ reject }) => reject(refreshError));
        refreshQueue = [];
        // Only a genuine 401 (invalid/expired refresh token) ends the session.
        // Transient failures (429 rate limit, 5xx, network) must NOT log the
        // user out or destroy tokens — the next attempt can retry.
        if (refreshError?.response?.status === 401) {
          clearTokens();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;