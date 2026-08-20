// @vitest-environment node
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import axios from 'axios';

// Live-backend integration tests for the auth refresh client.
// Requires the backend running on :3000 (the dev environment does).
// Skipped automatically when the backend is unreachable.

const BACKEND = 'http://localhost:3000';
process.env.VITE_API_BASE = `${BACKEND}/api/v1`;

const localStorageStub = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
})();

globalThis.localStorage = localStorageStub;
globalThis.window = { location: { pathname: '/dashboard', href: '' } };

// Dev secret only — mirrors backend .env JWT_ACCESS_SECRET. Never use in prod.
const SECRET = 'v4';

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signToken(payload, secret) {
  const body = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify(payload),
  )}`;
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function expiredAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  return signToken({ sub: 1, username: 'admin', role: 'admin', iat: now - 3600, exp: now - 60 }, SECRET);
}

async function backendUp() {
  try {
    await axios.get(`${BACKEND}/api/v1/health`, { timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

const up = await backendUp();

describe.skipIf(!up)('auth refresh client (live backend)', () => {
  let api;
  let authApi;

  beforeAll(async () => {
    vi.stubEnv('VITE_API_BASE', `${BACKEND}/api/v1`);
    api = (await import('./client.js')).default;
    authApi = await import('./authApi.js');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await authApi.logout();
    } catch {
      // logout best-effort in teardown
    }
    localStorage.clear();
  });

  it('login stores access token, refresh token and user', async () => {
    const user = await authApi.login({ username: 'admin', password: 'Admin@123' });
    expect(user.username).toBe('admin');
    expect(localStorage.getItem('dsp_access_token')).toBeTruthy();
    expect(localStorage.getItem('dsp_refresh_token')).toBeTruthy();
    expect(localStorage.getItem('dsp_user')).toBeTruthy();
  });

  it('expired access token is refreshed once and the original request is retried', async () => {
    await authApi.login({ username: 'admin', password: 'Admin@123' });
    localStorage.setItem('dsp_access_token', expiredAccessToken());
    const postSpy = vi.spyOn(axios, 'post');

    const { data } = await api.get('/customers?limit=1');

    expect(data.data).toBeTruthy();
    const refreshCalls = postSpy.mock.calls.filter(([url]) => url.includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    const stored = localStorage.getItem('dsp_access_token');
    expect(stored).toBeTruthy();
    expect(stored.length).toBeGreaterThan(50);
  });

  it('restoreSession with a still-valid access token makes no refresh call', async () => {
    await authApi.login({ username: 'admin', password: 'Admin@123' });
    const postSpy = vi.spyOn(axios, 'post');

    const user = await authApi.restoreSession();

    expect(user.username).toBe('admin');
    expect(postSpy.mock.calls.filter(([url]) => url.includes('/auth/refresh'))).toHaveLength(0);
  });

  it('concurrent restoreSession calls share a single refresh (single-flight)', async () => {
    await authApi.login({ username: 'admin', password: 'Admin@123' });
    localStorage.setItem('dsp_access_token', expiredAccessToken());
    localStorage.removeItem('dsp_user');
    const postSpy = vi.spyOn(axios, 'post');

    const [a, b] = await Promise.all([authApi.restoreSession(), authApi.restoreSession()]);

    expect(a?.username).toBe('admin');
    expect(b?.username).toBe('admin');
    const refreshCalls = postSpy.mock.calls.filter(([url]) => url.includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('revoked refresh token ends the session (401 clears tokens, no redirect)', async () => {
    await authApi.login({ username: 'admin', password: 'Admin@123' });
    localStorage.setItem('dsp_access_token', expiredAccessToken());
    localStorage.setItem('dsp_refresh_token', 'garbage-stale-token');

    const user = await authApi.restoreSession();

    expect(user).toBeNull();
    expect(localStorage.getItem('dsp_access_token')).toBeNull();
    expect(localStorage.getItem('dsp_refresh_token')).toBeNull();
  });

  it('transient refresh failure (429 rate limit) keeps tokens and does not redirect', async () => {
    await authApi.login({ username: 'admin', password: 'Admin@123' });
    localStorage.setItem('dsp_access_token', expiredAccessToken());
    const postSpy = vi.spyOn(axios, 'post').mockRejectedValueOnce({
      response: {
        status: 429,
        data: { error: { message: 'Too many requests, please try again later.' } },
      },
    });

    await expect(api.get('/customers?limit=1')).rejects.toMatchObject({
      response: { status: 429 },
    });

    expect(localStorage.getItem('dsp_access_token')).toBeTruthy();
    expect(localStorage.getItem('dsp_refresh_token')).toBeTruthy();
    expect(globalThis.window.location.href).toBe('');
    const refreshCalls = postSpy.mock.calls.filter(([url]) => url.includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });
});
