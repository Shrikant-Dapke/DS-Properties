import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import Partner from '../models/Partner.js';
import PartnerCapital from '../models/PartnerCapital.js';
import { AppError } from '../utils/errors.js';
import { pickFields, pageMeta } from '../utils/query.js';

const ALLOWED_FIELDS = ['name', 'phone', 'email', 'address', 'notes', 'status'];

export async function createPartner(body) {
  if (!body.name || !String(body.name).trim()) {
    throw new AppError('Partner name is required', 400);
  }
  return Partner.create(pickFields(body, ALLOWED_FIELDS));
}

export async function listPartners({ search, status, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
  }

  const meta = pageMeta(page, limit, 0);

  const [items, total] = await Promise.all([
    Partner.find(filter).sort({ createdAt: -1 }).skip(meta.skip).limit(meta.limitNum),
    Partner.countDocuments(filter),
  ]);
  meta.total = total;
  meta.totalPages = Math.ceil(total / meta.limitNum);

  return {
    items,
    pagination: { page: meta.page, limit: meta.limitNum, total: meta.total, totalPages: meta.totalPages },
  };
}

export async function getPartner(id) {
  const partner = await Partner.findById(id);
  if (!partner) throw new AppError('Partner not found', 404);
  return partner;
}

export async function updatePartner(id, body) {
  const partner = await Partner.findById(id);
  if (!partner) throw new AppError('Partner not found', 404);

  const data = pickFields(body, ALLOWED_FIELDS);
  if (data.name !== undefined && !String(data.name).trim()) {
    throw new AppError('Partner name cannot be empty', 400);
  }
  if (data.status !== undefined && !['Active', 'Inactive'].includes(data.status)) {
    throw new AppError('Invalid partner status', 400);
  }

  Object.assign(partner, data);
  await partner.save();
  return partner;
}

export async function deletePartner(id) {
  const partner = await Partner.findById(id);
  if (!partner) throw new AppError('Partner not found', 404);

  const capitalCount = await PartnerCapital.countDocuments({ partnerId: id });
  if (capitalCount > 0) {
    throw new AppError('Cannot delete partner with recorded capital contributions', 409);
  }

  await partner.deleteOne();
  return true;
}

// Aggregate capital summary for a partner (used by the detail page).
export async function getPartnerCapitalSummary(partnerId) {
  const [row] = await PartnerCapital.aggregate([
    { $match: { partnerId: new mongoose.Types.ObjectId(partnerId) } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const total = row && row.total !== null ? new Decimal(row.total.toString()) : new Decimal(0);
  const count = row ? row.count : 0;
  return { totalContributed: total.toString(), contributionCount: count };
}
