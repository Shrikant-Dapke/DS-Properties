import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app.js';
import { ROLES } from '../../src/config/constants.js';
import { pool } from '../setup.js';
import { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } from './testCredentials.js';

export const api = () => request(app);

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export async function login(username, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  return res.body.data;
}

export async function getAdminToken() {
  const data = await login(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);
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

let secondAdminGlobal;

// Test-only developer provisioning (mirrors scripts/provision-developer.js):
// inserts the owner account directly because the API rejects the developer
// role for every caller. One per test file (DB resets per file).
let developerGlobal;
export async function setupDeveloper(username = null, password = 'Owner@123456') {
  if (!developerGlobal) {
    const name = username || `owner_${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, 'Test Owner', 'developer')`,
      [name, passwordHash],
    );
    const loginData = await login(name, password);
    developerGlobal = { username: name, password, accessToken: loginData.accessToken };
  }
  return developerGlobal;
}

let partnerSeq = 0;

// Creates a business partner record (admin membership management: direct
// admin action, audited) and a login user linked to it, then logs in once.
// Returns { username, password, accessToken, partnerPublicId, userPublicId }.
// Callers must reuse the token: auth endpoints are rate-limited.
export async function setupPartner(adminToken, tag = 'p') {
  partnerSeq += 1;
  const suffix = `${tag}_${Date.now()}_${partnerSeq}`;
  const prec = await request(app)
    .post('/api/v1/partners')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Partner ${suffix}` });
  if (prec.status >= 400) throw new Error(`setupPartner record failed: ${JSON.stringify(prec.body)}`);
  const partnerPublicId = prec.body.data.entity?.publicId ?? prec.body.data.publicId;

  const username = `partner_${suffix}`.toLowerCase();
  const password = 'Test@1234';
  const ures = await request(app)
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password, fullName: `Partner ${suffix}`, role: ROLES.PARTNER, partnerPublicId });
  if (ures.status >= 400) throw new Error(`setupPartner user failed: ${JSON.stringify(ures.body)}`);
  const userPublicId = ures.body.data.entity?.publicId ?? ures.body.data.publicId;

  const loginData = await login(username, password);
  return { username, password, accessToken: loginData.accessToken, partnerPublicId, userPublicId };
}

// A ready-to-approve quorum: n linked partner users with tokens.
export async function setupPartnerQuorum(adminToken, n = 2, tag = 'q') {
  const quorum = [];
  for (let i = 0; i < n; i += 1) {
    quorum.push(await setupPartner(adminToken, `${tag}${i}`));
  }
  return quorum;
}

// Propose a business mutation as quorum[0]; returns the PENDING change request.
export async function proposeAsPartner(quorumOrPartner, method, url, body) {
  const proposer = Array.isArray(quorumOrPartner) ? quorumOrPartner[0] : quorumOrPartner;
  const res = await request(app)[method](url).set(authHeader(proposer.accessToken)).send(body);
  return res;
}

// Approve a change request as every listed partner; returns the last response.
export async function approveAsPartners(changeRequestPublicId, partners, comment) {
  let last = null;
  for (const p of partners) {
    last = await request(app)
      .post(`/api/v1/change-requests/${changeRequestPublicId}/approve`)
      .set(authHeader(p.accessToken))
      .send(comment ? { comment } : {});
  }
  return last;
}

// Full propose → unanimous-approve flow. Returns { proposal, approval, entity }.
export async function proposeAndApprove(quorum, method, url, body) {
  const proposal = await proposeAsPartner(quorum, method, url, body);
  if (proposal.status >= 400 || proposal.body.data.changeRequest?.status !== 'PENDING') {
    throw new Error(`proposeAndApprove proposal failed: ${proposal.status} ${JSON.stringify(proposal.body)}`);
  }
  const crPublicId = proposal.body.data.changeRequest.publicId;
  const approval = await approveAsPartners(crPublicId, quorum.slice(1));
  return { proposal, approval, entity: approval.body.data.entity, changeRequest: approval.body.data.changeRequest };
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
