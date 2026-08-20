import {
  listCustomers,
  findCustomerByPublicId,
  findCustomerById,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  countCustomerTransactions,
} from '../models/customerModel.js';
import { listCustomerLedger } from '../models/transactionModel.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { logAudit } from './auditService.js';

function serialize(customer) {
  return {
    publicId: customer.public_id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    notes: customer.notes,
    totalPaid: customer.total_paid,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}

export async function listAllCustomers({ search, page, limit, offset }) {
  const { total, rows } = await listCustomers({ search, page, limit, offset });
  return { total, rows: rows.map(serialize) };
}

export async function getCustomer(publicId) {
  const row = await findCustomerByPublicId(publicId);
  if (!row) throw new NotFoundError('Customer not found');
  const customer = await findCustomerById(row.id);
  return serialize(customer);
}

export async function createNewCustomer(data, ctx) {
  const customer = await createCustomer({
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    notes: data.notes,
  });

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.CREATE,
    domain: 'customers',
    recordId: customer.public_id,
    newValues: { name: customer.name },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(customer);
}

export async function updateExistingCustomer(publicId, data, ctx) {
  const row = await findCustomerByPublicId(publicId);
  if (!row) throw new NotFoundError('Customer not found');
  const before = await findCustomerById(row.id);

  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = v;
  }
  const customer = await updateCustomer(row.id, fields);

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.UPDATE,
    domain: 'customers',
    recordId: customer.public_id,
    oldValues: { name: before.name, phone: before.phone },
    newValues: fields,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(customer);
}

export async function deleteCustomer(publicId, ctx) {
  const row = await findCustomerByPublicId(publicId);
  if (!row) throw new NotFoundError('Customer not found');

  const txCount = await countCustomerTransactions(row.id);
  if (txCount > 0) {
    throw new ConflictError('Customer has financial records and cannot be deleted', 'HAS_TRANSACTIONS');
  }

  const customer = await softDeleteCustomer(row.id);

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.DELETE,
    domain: 'customers',
    recordId: customer.public_id,
    newValues: { name: customer.name },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { success: true };
}

export async function getCustomerLedger(publicId, { page, limit, offset }) {
  const row = await findCustomerByPublicId(publicId);
  if (!row) throw new NotFoundError('Customer not found');
  const { total, rows } = await listCustomerLedger(row.id, { page, limit, offset });
  return { total, rows };
}