import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import Income from '../models/Income.js';
import Category from '../models/Category.js';
import { AppError } from '../utils/errors.js';

function toDecimal128(value) {
  return mongoose.Types.Decimal128.fromString(new Decimal(value).toString());
}

async function validateIncomeCategory(categoryId, { requireActive }) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new AppError('Valid categoryId is required', 400);
  }
  const category = await Category.findById(categoryId);
  if (!category) throw new AppError('Category not found', 400);
  if (category.type !== 'income') {
    throw new AppError('Income category must be an income category', 400);
  }
  if (requireActive && !category.active) {
    throw new AppError('Selected category is inactive and cannot be used', 400);
  }
  return category;
}

function parseAmount(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new AppError('Income amount is required', 400);
  }
  let amount;
  try {
    amount = new Decimal(String(raw).trim());
  } catch {
    throw new AppError('Invalid income amount', 400);
  }
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppError('Income amount must be greater than zero', 400);
  }
  return amount;
}

function parseDate(raw) {
  if (!raw) throw new AppError('Income date is required', 400);
  const date = new Date(raw);
  if (isNaN(date.getTime())) throw new AppError('Invalid income date', 400);
  return date;
}

export async function createIncome(body) {
  const amount = parseAmount(body.amount);
  const date = parseDate(body.date);
  await validateIncomeCategory(body.categoryId, { requireActive: true });

  const income = await Income.create({
    amount: toDecimal128(amount),
    date,
    categoryId: body.categoryId,
    description: body.description || undefined,
    reference: body.reference || undefined,
    notes: body.notes || undefined,
  });

  return Income.findById(income._id).populate('categoryId', 'name type isSeed active');
}

export async function listIncome({
  category,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
} = {}) {
  const filter = {};

  if (category) {
    if (!mongoose.Types.ObjectId.isValid(category)) throw new AppError('Invalid category filter', 400);
    filter.categoryId = category;
  }

  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (isNaN(d.getTime())) throw new AppError('Invalid dateFrom', 400);
      range.$gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (isNaN(d.getTime())) throw new AppError('Invalid dateTo', 400);
      range.$lte = d;
    }
    filter.date = range;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Income.find(filter)
      .populate('categoryId', 'name type isSeed active')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Income.countDocuments(filter),
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

export async function getIncome(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid income id', 400);
  const income = await Income.findById(id).populate('categoryId', 'name type isSeed active');
  if (!income) throw new AppError('Income not found', 404);
  return income;
}

export async function updateIncome(id, body) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid income id', 400);
  const income = await Income.findById(id);
  if (!income) throw new AppError('Income not found', 404);

  if (body.amount !== undefined) {
    const amount = parseAmount(body.amount);
    income.amount = toDecimal128(amount);
  }
  if (body.date !== undefined) {
    income.date = parseDate(body.date);
  }
  if (body.categoryId !== undefined && body.categoryId !== income.categoryId.toString()) {
    // Changing the category requires an active income category.
    await validateIncomeCategory(body.categoryId, { requireActive: true });
    income.categoryId = body.categoryId;
  }
  if (body.description !== undefined) income.description = body.description;
  if (body.reference !== undefined) income.reference = body.reference;
  if (body.notes !== undefined) income.notes = body.notes;

  await income.save();
  return Income.findById(income._id).populate('categoryId', 'name type isSeed active');
}
