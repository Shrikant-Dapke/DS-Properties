import mongoose from 'mongoose';
import Income from '../models/Income.js';
import Category from '../models/Category.js';
import { syncTransaction, runInTransaction } from './finance.service.js';
import { AppError } from '../utils/errors.js';
import { toDecimal128, parseAmount, parseDate } from '../utils/money.js';
import { dateRangeFilter, pageMeta } from '../utils/query.js';

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

export async function createIncome(body) {
  const amount = parseAmount(body.amount, 'Income amount');
  const date = parseDate(body.date, 'Income date');
  await validateIncomeCategory(body.categoryId, { requireActive: true });

  return runInTransaction(async (session) => {
    const income = await Income.create(
      [
        {
          amount: toDecimal128(amount),
          date,
          categoryId: body.categoryId,
          description: body.description || undefined,
          reference: body.reference || undefined,
          notes: body.notes || undefined,
        },
      ],
      { session }
    );

    const created = await Income.findById(income[0]._id)
      .populate('categoryId', 'name type isSeed active')
      .session(session);
    await syncTransaction('Income', created, { operation: 'create', session });
    return created;
  });
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

  const range = dateRangeFilter(dateFrom, dateTo);
  if (range) filter.date = range;

  const meta = pageMeta(page, limit, 0);
  const [items, total] = await Promise.all([
    Income.find(filter)
      .populate('categoryId', 'name type isSeed active')
      .sort({ date: -1, createdAt: -1 })
      .skip(meta.skip)
      .limit(meta.limitNum),
    Income.countDocuments(filter),
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

export async function getIncome(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid income id', 400);
  const income = await Income.findById(id).populate('categoryId', 'name type isSeed active');
  if (!income) throw new AppError('Income not found', 404);
  return income;
}

export async function updateIncome(id, body) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid income id', 400);

  return runInTransaction(async (session) => {
    const income = await Income.findById(id).session(session);
    if (!income) throw new AppError('Income not found', 404);

    if (body.amount !== undefined) {
      const amount = parseAmount(body.amount, 'Income amount');
      income.amount = toDecimal128(amount);
    }
    if (body.date !== undefined) {
      income.date = parseDate(body.date, 'Income date');
    }
    if (body.categoryId !== undefined && body.categoryId !== income.categoryId.toString()) {
      // Changing the category requires an active income category.
      await validateIncomeCategory(body.categoryId, { requireActive: true });
      income.categoryId = body.categoryId;
    }
    if (body.description !== undefined) income.description = body.description;
    if (body.reference !== undefined) income.reference = body.reference;
    if (body.notes !== undefined) income.notes = body.notes;

    await income.save({ session });
    const updated = await Income.findById(income._id)
      .populate('categoryId', 'name type isSeed active')
      .session(session);
    await syncTransaction('Income', updated, { operation: 'update', session });
    return updated;
  });
}
