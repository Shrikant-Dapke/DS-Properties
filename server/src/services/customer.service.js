import Customer from '../models/Customer.js';
import Plot from '../models/Plot.js';
import { AppError } from '../utils/errors.js';
import { pickFields, pageMeta } from '../utils/query.js';

const ALLOWED_FIELDS = ['name', 'phone', 'email', 'address', 'notes'];

export async function createCustomer(body) {
  if (!body.name || !String(body.name).trim()) {
    throw new AppError('Customer name is required', 400);
  }

  const customer = await Customer.create(pickFields(body, ALLOWED_FIELDS));
  return customer;
}

export async function listCustomers({ search, page = 1, limit = 20 } = {}) {
  const filter = {};

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ name: regex }, { phone: regex }];
  }

  const meta = pageMeta(page, limit, 0);

  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(meta.skip).limit(meta.limitNum),
    Customer.countDocuments(filter),
  ]);
  meta.total = total;
  meta.totalPages = Math.ceil(total / meta.limitNum);

  return {
    items,
    pagination: {
      page: meta.page,
      limit: meta.limitNum,
      total: meta.total,
      totalPages: meta.totalPages,
    },
  };
}

export async function getCustomer(id) {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError('Customer not found', 404);
  return customer;
}

export async function updateCustomer(id, body) {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError('Customer not found', 404);

  const data = pickFields(body, ALLOWED_FIELDS);
  if (data.name !== undefined && !String(data.name).trim()) {
    throw new AppError('Customer name cannot be empty', 400);
  }

  Object.assign(customer, data);
  await customer.save();
  return customer;
}

export async function deleteCustomer(id) {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError('Customer not found', 404);

  const plotCount = await Plot.countDocuments({ customerId: id });
  if (plotCount > 0) {
    throw new AppError('Cannot delete customer with associated plots', 409);
  }

  await customer.deleteOne();
  return true;
}
