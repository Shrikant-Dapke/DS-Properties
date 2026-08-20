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
  return { username, password, ...res.body.data };
}

export async function setupOperator() {
  const adminToken = await getAdminToken();
  const user = await createUserWithRole(adminToken, {
    username: `operator_${Date.now()}`,
    role: ROLES.OPERATOR,
  });
  return user;
}

export async function setupViewer() {
  const adminToken = await getAdminToken();
  const user = await createUserWithRole(adminToken, {
    username: `viewer_${Date.now()}`,
    role: ROLES.VIEWER,
  });
  return user;
}