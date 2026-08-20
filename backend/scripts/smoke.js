import app from '../src/app.js';

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const check = (label, res) => console.log(label, res.status, JSON.stringify(res.body).slice(0, 180));

  try {
    let res = await fetch(`${base}/api/v1/health`);
    check('health', { status: res.status, body: await res.json() });

    res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
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