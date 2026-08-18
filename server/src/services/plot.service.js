import mongoose from 'mongoose';
import Plot from '../models/Plot.js';
import Payment from '../models/Payment.js';
import Customer from '../models/Customer.js';
import { AppError } from '../utils/errors.js';
import { pickFields, pageMeta } from '../utils/query.js';

const ALLOWED = [
  'plotNumber',
  'area',
  'areaUnit',
  'location',
  'price',
  'status',
  'customerId',
  'notes',
];

function fromDecimal(value) {
  if (value === '' || value === null || value === undefined) return null;
  return mongoose.Types.Decimal128.fromString(String(value).trim());
}

async function resolveCustomer(customerId) {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    throw new AppError('Invalid customer id', 400);
  }
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found', 400);
  return customerId;
}

export async function createPlot(body) {
  if (!body.plotNumber || !String(body.plotNumber).trim()) {
    throw new AppError('Plot number is required', 400);
  }
  if (body.price === undefined || body.price === null || String(body.price).trim() === '') {
    throw new AppError('Plot price is required', 400);
  }

  const data = pickFields(body, ALLOWED);
  data.plotNumber = String(body.plotNumber).trim();

  let priceDecimal;
  try {
    priceDecimal = fromDecimal(body.price);
  } catch {
    throw new AppError('Invalid price', 400);
  }
  data.price = priceDecimal;

  if (body.customerId) {
    data.customerId = await resolveCustomer(body.customerId);
  } else {
    data.customerId = null;
  }

  try {
    return await Plot.create(data);
  } catch (err) {
    if (err.code === 11000) throw new AppError('Plot number already exists', 409);
    throw err;
  }
}

export async function listPlots({ search, status, customer, page = 1, limit = 20 } = {}) {
  const filter = {};

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.plotNumber = new RegExp(escaped, 'i');
  }
  if (status) filter.status = status;
  if (customer) {
    if (!mongoose.Types.ObjectId.isValid(customer)) {
      throw new AppError('Invalid customer filter', 400);
    }
    filter.customerId = customer;
  }

  const meta = pageMeta(page, limit, 0);

  const [items, total] = await Promise.all([
    Plot.find(filter)
      .populate('customerId', 'name')
      .sort({ createdAt: -1 })
      .skip(meta.skip)
      .limit(meta.limitNum),
    Plot.countDocuments(filter),
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

export async function getPlot(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid plot id', 400);
  const plot = await Plot.findById(id).populate('customerId', 'name');
  if (!plot) throw new AppError('Plot not found', 404);
  return plot;
}

export async function updatePlot(id, body) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid plot id', 400);
  const plot = await Plot.findById(id);
  if (!plot) throw new AppError('Plot not found', 404);

  const data = pickFields(body, ALLOWED);
  if (data.plotNumber !== undefined) data.plotNumber = String(data.plotNumber).trim();
  if (data.price !== undefined) {
    try {
      data.price = fromDecimal(data.price);
    } catch {
      throw new AppError('Invalid price', 400);
    }
  }

  if (body.customerId !== undefined) {
    const hasPayments = await Payment.countDocuments({ plotId: plot._id });
    if (hasPayments > 0) {
      const requested = body.customerId ? String(body.customerId) : null;
      const current = plot.customerId ? plot.customerId.toString() : null;
      if (requested !== current) {
        throw new AppError(
          'Plot with recorded payments cannot change or remove its customer',
          409
        );
      }
      data.customerId = plot.customerId;
    } else if (body.customerId) {
      data.customerId = await resolveCustomer(body.customerId);
    } else {
      data.customerId = null;
    }
  }

  try {
    Object.assign(plot, data);
    await plot.save();
    return plot;
  } catch (err) {
    if (err.code === 11000) throw new AppError('Plot number already exists', 409);
    throw err;
  }
}

export async function deletePlot(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid plot id', 400);
  const plot = await Plot.findById(id);
  if (!plot) throw new AppError('Plot not found', 404);
  await plot.deleteOne();
  return true;
}
