import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.message || 'Login failed. Please try again.');
      } else if (err.request) {
        setError('Cannot reach the server. Please ensure the API is running.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm rounded-lg bg-chalk p-8 shadow-lg">
        <h1 className="mb-1 font-display text-2xl text-navy">DS Properties</h1>
        <p className="mb-6 font-mono text-xs uppercase tracking-widest text-lavender">
          Admin Sign In
        </p>

        {error && (
          <div className="mb-4 rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-sans text-sm text-navy/70" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-navy/20 bg-white px-3 py-2 font-sans text-navy outline-none focus:border-indigo focus:ring-1 focus:ring-indigo"
              required
            />
          </div>

          <div>
            <label className="mb-1 block font-sans text-sm text-navy/70" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-navy/20 bg-white px-3 py-2 font-sans text-navy outline-none focus:border-indigo focus:ring-1 focus:ring-indigo"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-indigo px-4 py-2 font-sans font-medium text-white transition-colors duration-200 hover:bg-indigo/90 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
