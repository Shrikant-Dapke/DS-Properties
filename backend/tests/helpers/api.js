import request from 'supertest';
import app from '../../src/app.js';
import { ROLES } from '../../src/config/constants.js';

export const api = () => request(app);

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export async function login(username, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  return res.body.data;
}

export async function getAdminToken() {
  const data = await login('admin', 'Admin@123');
  return data.accessToken;
}

export async function createUserWithRole(token, { username, password = 'Test@1234', role }) {
  const res = await request(app)
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ username, password, fullName: `User ${role}`, role });
  if (res.status >= 400) throw new Error(`createUserWithRole failed: ${JSON.stringify(res.body)}`);
  // Creating an ADMIN is governed; in a single-admin org it auto-applies and the
  // user is returned under `entity`. Other roles return the user directly.
  const data = res.body.data.entity ?? res.body.data;
  const loginData = await login(username, password);
  return { username, password, accessToken: loginData.accessToken, ...data };
}

let viewerGlobal;
let secondAdminGlobal;

export async function setupViewer() {
  if (!viewerGlobal) {
    const adminToken = await getAdminToken();
    viewerGlobal = await createUserWithRole(adminToken, {
      username: `viewer_${Date.now()}`,
      role: ROLES.READ_ONLY,
    });
  }
  return viewerGlobal;
}

export async function setupSecondAdmin() {
  if (!secondAdminGlobal) {
    const adminToken = await getAdminToken();
    secondAdminGlobal = await createUserWithRole(adminToken, {
      username: `admin2_${Date.now()}`,
      role: ROLES.ADMIN,
    });
  }
  return secondAdminGlobal;
}
