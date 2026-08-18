import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Category from '../models/Category.js';
import { syncTransaction, removeTransaction, runInTransaction } from './finance.service.js';
import { AppError } from '../utils/errors.js';
import { toDecimal128, parseAmount, parseDate } from '../utils/money.js';
import { dateRangeFilter, pageMeta } from '../utils/query.js';

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

export async function createExpense(body) {
  const amount = parseAmount(body.amount, 'Expense amount');
  const date = parseDate(body.date, 'Expense date');
  await validateExpenseCategory(body.categoryId, { requireActive: true });

  return runInTransaction(async (session) => {
    const expense = await Expense.create(
      [
        {
          amount: toDecimal128(amount),
          date,
          categoryId: body.categoryId,
          description: body.description || undefined,
          reference: body.reference || undefined,
          notes: body.notes || undefined,
          deleted: false,
        },
      ],
      { session }
    );

    const created = await Expense.findById(expense[0]._id)
      .populate('categoryId', 'name type isSeed active')
      .session(session);
    await syncTransaction('Expense', created, { operation: 'create', session });
    return created;
  });
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

  const range = dateRangeFilter(dateFrom, dateTo);
  if (range) filter.date = range;

  if (!includeDeleted) filter.deleted = false;

  const meta = pageMeta(page, limit, 0);
  const [items, total] = await Promise.all([
    Expense.find(filter)
      .populate('categoryId', 'name type isSeed active')
      .sort({ date: -1, createdAt: -1 })
      .skip(meta.skip)
      .limit(meta.limitNum),
    Expense.countDocuments(filter),
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

  return runInTransaction(async (session) => {
    const expense = await Expense.findById(id).session(session);
    if (!expense) throw new AppError('Expense not found', 404);

    if (body.amount !== undefined) {
      const amount = parseAmount(body.amount, 'Expense amount');
      expense.amount = toDecimal128(amount);
    }
    if (body.date !== undefined) {
      expense.date = parseDate(body.date, 'Expense date');
    }
    if (body.categoryId !== undefined && body.categoryId !== expense.categoryId.toString()) {
      // Changing the category requires an active expense category.
      await validateExpenseCategory(body.categoryId, { requireActive: true });
      expense.categoryId = body.categoryId;
    }
    if (body.description !== undefined) expense.description = body.description;
    if (body.reference !== undefined) expense.reference = body.reference;
    if (body.notes !== undefined) expense.notes = body.notes;

    await expense.save({ session });
    const updated = await Expense.findById(expense._id)
      .populate('categoryId', 'name type isSeed active')
      .session(session);
    await syncTransaction('Expense', updated, { operation: 'update', session });
    return updated;
  });
}

export async function softDeleteExpense(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid expense id', 400);

  return runInTransaction(async (session) => {
    const expense = await Expense.findById(id).session(session);
    if (!expense) throw new AppError('Expense not found', 404);
    expense.deleted = true;
    await expense.save({ session });
    await removeTransaction('Expense', id, { session });
    return Expense.findById(expense._id)
      .populate('categoryId', 'name type isSeed active')
      .session(session);
  });
}
