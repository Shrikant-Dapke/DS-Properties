import mongoose from 'mongoose';
import Plot from '../models/Plot.js';
import Payment from '../models/Payment.js';
import Customer from '../models/Customer.js';
import { AppError } from '../utils/errors.js';

const ALLOWED = [
  'plotNumber',
  'area',
  'areaUnit',
  'location',
  'price',
  'agreementAmount',
  'status',
  'customerId',
  'notes',
];

function fromDecimal(value) {
  if (value === '' || value === null || value === undefined) return null;
  return mongoose.Types.Decimal128.fromString(String(value).trim());
}

function pick(body) {
  const data = {};
  for (const field of ALLOWED) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
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

  const data = pick(body);
  data.plotNumber = String(body.plotNumber).trim();

  let priceDecimal;
  try {
    priceDecimal = fromDecimal(body.price);
  } catch {
    throw new AppError('Invalid price', 400);
  }
  data.price = priceDecimal;

  if (
    body.agreementAmount !== undefined &&
    body.agreementAmount !== null &&
    String(body.agreementAmount).trim() !== ''
  ) {
    try {
      data.agreementAmount = fromDecimal(body.agreementAmount);
    } catch {
      throw new AppError('Invalid agreement amount', 400);
    }
  } else {
    data.agreementAmount = null;
  }

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

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Plot.find(filter)
      .populate('customerId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Plot.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
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

  const data = pick(body);
  if (data.plotNumber !== undefined) data.plotNumber = String(data.plotNumber).trim();
  if (data.price !== undefined) {
    try {
      data.price = fromDecimal(data.price);
    } catch {
      throw new AppError('Invalid price', 400);
    }
  }
  if (data.agreementAmount !== undefined) {
    if (data.agreementAmount === null || data.agreementAmount === '') {
      data.agreementAmount = null;
    } else {
      try {
        data.agreementAmount = fromDecimal(data.agreementAmount);
      } catch {
        throw new AppError('Invalid agreement amount', 400);
      }
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
