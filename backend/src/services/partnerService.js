import {
  listPartners,
  findPartnerByPublicId,
  findPartnerById,
  createPartner,
  updatePartner,
  softDeletePartner,
  countPartnerTransactions,
} from '../models/partnerModel.js';
import { listPartnerLedger } from '../models/transactionModel.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { logAudit } from './auditService.js';

function serialize(partner) {
  return {
    publicId: partner.public_id,
    name: partner.name,
    phone: partner.phone,
    email: partner.email,
    address: partner.address,
    notes: partner.notes,
    isActive: partner.is_active,
    totalInflow: partner.total_inflow,
    createdAt: partner.created_at,
    updatedAt: partner.updated_at,
  };
}

export async function listAllPartners({ search, activeOnly, page, limit, offset }) {
  const { total, rows } = await listPartners({ search, activeOnly, page, limit, offset });
  return { total, rows: rows.map(serialize) };
}

export async function getPartner(publicId) {
  const row = await findPartnerByPublicId(publicId);
  if (!row) throw new NotFoundError('Partner not found');
  const partner = await findPartnerById(row.id);
  return serialize(partner);
}

export async function createNewPartner(data, ctx) {
  const partner = await createPartner({
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    notes: data.notes,
  });

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.CREATE,
    domain: 'partners',
    recordId: partner.public_id,
    newValues: { name: partner.name },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(partner);
}

export async function updateExistingPartner(publicId, data, ctx) {
  const row = await findPartnerByPublicId(publicId);
  if (!row) throw new NotFoundError('Partner not found');
  const before = await findPartnerById(row.id);

  const fields = {};
  const columnMap = { name: 'name', phone: 'phone', email: 'email', address: 'address', notes: 'notes', isActive: 'is_active' };
  for (const [k, v] of Object.entries(data)) {
    fields[columnMap[k]] = v;
  }
  const partner = await updatePartner(row.id, fields);

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.UPDATE,
    domain: 'partners',
    recordId: partner.public_id,
    oldValues: { name: before.name, phone: before.phone, isActive: before.is_active },
    newValues: fields,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(partner);
}

export async function deletePartner(publicId, ctx) {
  const row = await findPartnerByPublicId(publicId);
  if (!row) throw new NotFoundError('Partner not found');

  const txCount = await countPartnerTransactions(row.id);
  if (txCount > 0) {
    throw new ConflictError('Partner has financial records and cannot be deleted', 'HAS_TRANSACTIONS');
  }

  const partner = await softDeletePartner(row.id);

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.DELETE,
    domain: 'partners',
    recordId: partner.public_id,
    newValues: { name: partner.name },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { success: true };
}

export async function getPartnerLedger(publicId, { page, limit, offset }) {
  const row = await findPartnerByPublicId(publicId);
  if (!row) throw new NotFoundError('Partner not found');
  const { total, rows } = await listPartnerLedger(row.id, { page, limit, offset });
  return { total, rows };
}