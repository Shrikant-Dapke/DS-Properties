import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import Expense from '../models/Expense.js';
import Category from '../models/Category.js';
import { AppError } from '../utils/errors.js';

function toDecimal128(value) {
  return mongoose.Types.Decimal128.fromString(new Decimal(value).toString());
}

async function validateExpenseCategory(categoryId, { requireActive }) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new AppError('Valid categoryId is required', 400);
  }
  const category = await Category.findById(categoryId);
  if (!category) throw new AppError('Category not found', 400);
  if (category.type !== 'expense') {
    throw new AppError('Expense category must be an expense category', 400);
  }
  if (requireActive && !category.active) {
    throw new AppError('Selected category is inactive and cannot be used', 400);
  }
  return category;
}

function parseAmount(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new AppError('Expense amount is required', 400);
  }
  let amount;
  try {
    amount = new Decimal(String(raw).trim());
  } catch {
    throw new AppError('Invalid expense amount', 400);
  }
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppError('Expense amount must be greater than zero', 400);
  }
  return amount;
}

function parseDate(raw) {
  if (!raw) throw new AppError('Expense date is required', 400);
  const date = new Date(raw);
  if (isNaN(date.getTime())) throw new AppError('Invalid expense date', 400);
  return date;
}

export async function createExpense(body) {
  const amount = parseAmount(body.amount);
  const date = parseDate(body.date);
  await validateExpenseCategory(body.categoryId, { requireActive: true });

  const expense = await Expense.create({
    amount: toDecimal128(amount),
    date,
    categoryId: body.categoryId,
    description: body.description || undefined,
    reference: body.reference || undefined,
    notes: body.notes || undefined,
    deleted: false,
  });

  return Expense.findById(expense._id).populate('categoryId', 'name type isSeed active');
}

export async function listExpenses({
  category,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
  includeDeleted = false,
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

  if (!includeDeleted) filter.deleted = false;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Expense.find(filter)
      .populate('categoryId', 'name type isSeed active')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Expense.countDocuments(filter),
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

export async function getExpense(id, { includeDeleted = false } = {}) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid expense id', 400);
  const query = Expense.findById(id).populate('categoryId', 'name type isSeed active');
  const expense = await query;
  if (!expense) throw new AppError('Expense not found', 404);
  if (expense.deleted && !includeDeleted) {
    // Still returnable by id for direct lookups; soft-deleted flag is visible to client.
  }
  return expense;
}

export async function updateExpense(id, body) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid expense id', 400);
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError('Expense not found', 404);

  if (body.amount !== undefined) {
    const amount = parseAmount(body.amount);
    expense.amount = toDecimal128(amount);
  }
  if (body.date !== undefined) {
    expense.date = parseDate(body.date);
  }
  if (body.categoryId !== undefined && body.categoryId !== expense.categoryId.toString()) {
    // Changing the category requires an active expense category.
    await validateExpenseCategory(body.categoryId, { requireActive: true });
    expense.categoryId = body.categoryId;
  }
  if (body.description !== undefined) expense.description = body.description;
  if (body.reference !== undefined) expense.reference = body.reference;
  if (body.notes !== undefined) expense.notes = body.notes;

  await expense.save();
  return Expense.findById(expense._id).populate('categoryId', 'name type isSeed active');
}

export async function softDeleteExpense(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid expense id', 400);
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError('Expense not found', 404);
  expense.deleted = true;
  await expense.save();
  return Expense.findById(expense._id).populate('categoryId', 'name type isSeed active');
}
