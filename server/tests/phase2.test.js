import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { signToken } from '../src/utils/jwt.js';
import User from '../src/models/User.js';
import Plot from '../src/models/Plot.js';
import ChangeRequest from '../src/models/ChangeRequest.js';
import AuditLog from '../src/models/AuditLog.js';
import bcrypt from 'bcryptjs';

const MONGO_URI = (
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27018/ds_properties?replicaSet=rs0'
).replace(/\/ds_properties(\?|$)/, '/ds_properties_phase2_test$1');

let server;
let base;

async function makeUser(role, opts = {}) {
  const name = opts.name || `${role}-${Math.random().toString(36).slice(2, 7)}`;
  const user = await User.create({
    username: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.dev`,
    passwordHash: bcrypt.hashSync('password123', 10),
    name,
    role,
    active: opts.active !== false,
  });
  const token = signToken({ sub: user._id.toString(), role: user.role });
  return { user, token };
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

before(async () => {
  await mongoose.connect(MONGO_URI);
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await ChangeRequest.deleteMany({});
  await AuditLog.deleteMany({});
  await Plot.deleteMany({});
  await User.deleteMany({});
});

test('two-partner E2E: pending -> approved -> committed and entity updated', async () => {
  const { user: p1, token: p1Token } = await makeUser('partner', { name: 'P1' });
  const { user: p2, token: p2Token } = await makeUser('partner', { name: 'P2' });
  const plot = await Plot.create({
    plotNumber: 'A1',
    price: '100',
    size: '1000',
  });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      entityId: plot._id.toString(),
      operation: 'update',
      changes: [{ field: 'price', newValue: '200' }],
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.data.status, 'PENDING');
  const crId = created.data.data._id;

  const list = await req('GET', '/api/change-requests', { token: p2Token });
  assert.equal(list.status, 200);
  assert.equal(list.data.data.length, 1);

  const approved = await req('POST', `/api/change-requests/${crId}/approve`, {
    token: p2Token,
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.data.status, 'COMMITTED');
  assert.equal(approved.data.data.committedBy.toString(), p1._id.toString());

  const updated = await Plot.findById(plot._id);
  assert.equal(updated.price.toString(), '200');

  const audit = await AuditLog.find({ changeRequestId: crId });
  assert.ok(audit.some((a) => a.operation === 'commit'));
  assert.ok(audit.some((a) => a.operation === 'approve'));
  assert.ok(
    audit.some((a) => a.operation === 'update' && a.field === 'price')
  );
});

test('rejection keeps official data unchanged', async () => {
  const { token: p1Token } = await makeUser('partner', { name: 'P1' });
  const { token: p2Token } = await makeUser('partner', { name: 'P2' });
  const plot = await Plot.create({ plotNumber: 'B1', price: '100' });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      entityId: plot._id.toString(),
      operation: 'update',
      changes: [{ field: 'price', newValue: '300' }],
    },
  });
  const crId = created.data.data._id;

  const rejected = await req('POST', `/api/change-requests/${crId}/reject`, {
    token: p2Token,
    body: { reason: 'too high' },
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.data.data.status, 'REJECTED');
  assert.equal(rejected.data.data.rejectionReason, 'too high');

  const updated = await Plot.findById(plot._id);
  assert.equal(updated.price.toString(), '100');
});

test('requester cannot approve own request', async () => {
  const { user: p1, token: p1Token } = await makeUser('partner', { name: 'P1' });
  await makeUser('partner', { name: 'P2' });
  const plot = await Plot.create({ plotNumber: 'C1', price: '100' });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      entityId: plot._id.toString(),
      operation: 'update',
      changes: [{ field: 'price', newValue: '500' }],
    },
  });
  const crId = created.data.data._id;

  const selfApprove = await req('POST', `/api/change-requests/${crId}/approve`, {
    token: p1Token,
  });
  assert.equal(selfApprove.status, 403);
});

test('admin is forbidden from change-request endpoints (isolation)', async () => {
  const { token: p1Token } = await makeUser('partner', { name: 'P1' });
  await makeUser('partner', { name: 'P2' });
  const { token: adminToken } = await makeUser('admin', { name: 'Admin' });

  await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      operation: 'create',
      changes: [{ field: 'plotNumber', newValue: 'Z9' }],
    },
  });

  const adminList = await req('GET', '/api/change-requests', {
    token: adminToken,
  });
  assert.equal(adminList.status, 403);

  const adminCreate = await req('POST', '/api/change-requests', {
    token: adminToken,
    body: { entityType: 'Plot', operation: 'create', changes: [{ field: 'plotNumber', newValue: 'X' }] },
  });
  assert.equal(adminCreate.status, 403);

  const adminApprove = await req('POST', '/api/change-requests/abc/approve', {
    token: adminToken,
  });
  assert.equal(adminApprove.status, 403);
});

test('developer is excluded from approval workflow but can view and cancel', async () => {
  const { token: p1Token } = await makeUser('partner', { name: 'P1' });
  const { token: p2Token } = await makeUser('partner', { name: 'P2' });
  const { token: devToken } = await makeUser('developer', { name: 'Dev' });
  const plot = await Plot.create({ plotNumber: 'D1', price: '100' });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      entityId: plot._id.toString(),
      operation: 'update',
      changes: [{ field: 'price', newValue: '700' }],
    },
  });
  const crId = created.data.data._id;

  const devApprove = await req('POST', `/api/change-requests/${crId}/approve`, {
    token: devToken,
  });
  assert.equal(devApprove.status, 403);

  const devView = await req('GET', '/api/change-requests', { token: devToken });
  assert.equal(devView.status, 200);
  assert.equal(devView.data.data.length, 1);

  const devCancel = await req('POST', `/api/change-requests/${crId}/cancel`, {
    token: devToken,
  });
  assert.equal(devCancel.status, 200);
  assert.equal(devCancel.data.data.status, 'CANCELLED');
});

test('duplicate approval rejected; approval after commit rejected', async () => {
  const { token: p1Token } = await makeUser('partner', { name: 'P1' });
  const { token: p2Token } = await makeUser('partner', { name: 'P2' });
  const plot = await Plot.create({ plotNumber: 'E1', price: '100' });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      entityId: plot._id.toString(),
      operation: 'update',
      changes: [{ field: 'price', newValue: '800' }],
    },
  });
  const crId = created.data.data._id;

  const first = await req('POST', `/api/change-requests/${crId}/approve`, {
    token: p2Token,
  });
  assert.equal(first.status, 200);

  const dup = await req('POST', `/api/change-requests/${crId}/approve`, {
    token: p2Token,
  });
  assert.equal(dup.status, 409);
});

test('sole active partner => auto-commit on creation', async () => {
  const { user: p1, token: p1Token } = await makeUser('partner', { name: 'P1' });
  const p2 = await (await import('../src/models/User.js')).default.create({
    username: `p2-${Date.now()}`,
    passwordHash: bcrypt.hashSync('password123', 10),
    name: 'P2',
    role: 'partner',
    active: false,
  });
  void p2;
  const plot = await Plot.create({ plotNumber: 'F1', price: '100' });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      entityId: plot._id.toString(),
      operation: 'update',
      changes: [{ field: 'price', newValue: '900' }],
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.data.status, 'COMMITTED');
  assert.equal(created.data.data.committedBy.toString(), p1._id.toString());

  const updated = await Plot.findById(plot._id);
  assert.equal(updated.price.toString(), '900');
});

test('inactive partner cannot approve', async () => {
  const { token: p1Token } = await makeUser('partner', { name: 'P1' });
  const { user: p2, token: p2Token } = await makeUser('partner', { name: 'P2' });
  const plot = await Plot.create({ plotNumber: 'G1', price: '100' });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      entityId: plot._id.toString(),
      operation: 'update',
      changes: [{ field: 'price', newValue: '1000' }],
    },
  });
  const crId = created.data.data._id;

  p2.active = false;
  await p2.save();

  const approve = await req('POST', `/api/change-requests/${crId}/approve`, {
    token: p2Token,
  });
  assert.equal(approve.status, 401);
});

test('resubmit rejected request creates a new pending request to same approver', async () => {
  const { user: p1, token: p1Token } = await makeUser('partner', { name: 'P1' });
  const { token: p2Token } = await makeUser('partner', { name: 'P2' });
  const plot = await Plot.create({ plotNumber: 'H1', price: '100' });

  const created = await req('POST', '/api/change-requests', {
    token: p1Token,
    body: {
      entityType: 'Plot',
      entityId: plot._id.toString(),
      operation: 'update',
      changes: [{ field: 'price', newValue: '1100' }],
    },
  });
  const crId = created.data.data._id;
  await req('POST', `/api/change-requests/${crId}/reject`, {
    token: p2Token,
    body: { reason: 'nope' },
  });

  const resub = await req('POST', `/api/change-requests/${crId}/resubmit`, {
    token: p1Token,
  });
  assert.equal(resub.status, 201);
  assert.equal(resub.data.data.status, 'PENDING');
  assert.equal(resub.data.data.requestedBy._id.toString(), p1._id.toString());

  const after = await Plot.findById(plot._id);
  assert.equal(after.price.toString(), '100');
});
