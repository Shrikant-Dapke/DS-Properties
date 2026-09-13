import app from '../src/app.js';

// Local-dev smoke test (runs against the dev DB). Credentials are
// env-overridable and fall back to the seed's LOCAL DEV default
// (see backend/seeds/002_seed_admin_user.js) — never use the fallback
// in production.
const SMOKE_ADMIN_USERNAME =
  process.env.SMOKE_ADMIN_USERNAME || process.env.TEST_ADMIN_USERNAME || 'admin';
const SMOKE_ADMIN_PASSWORD =
  process.env.SMOKE_ADMIN_PASSWORD ||
  process.env.SEED_ADMIN_PASSWORD ||
  process.env.TEST_ADMIN_PASSWORD ||
  'Admin@123';

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const check = (label, res) => console.log(label, res.status, JSON.stringify(res.body).slice(0, 180));

  try {
    let res = await fetch(`${base}/api/v1/health`);
    check('health', { status: res.status, body: await res.json() });

    res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: SMOKE_ADMIN_USERNAME, password: SMOKE_ADMIN_PASSWORD }),
    });
    const login = await res.json();
    check('login', { status: res.status, body: login });

    const token = login.data?.accessToken;
    res = await fetch(`${base}/api/v1/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check('dashboard', { status: res.status, body: await res.json() });

    res = await fetch(`${base}/api/v1/customers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check('customers', { status: res.status, body: await res.json() });

    res = await fetch(`${base}/api/v1/categories/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check('categories', { status: res.status, body: await res.json() });
  } catch (err) {
    console.error('SMOKE FAILED', err);
  } finally {
    server.close(() => process.exit(0));
  }
});