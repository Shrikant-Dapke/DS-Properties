import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { AppError } from '../utils/errors.js';

const TYPES = ['expense', 'income'];

function normalize(name) {
  return String(name).trim().toLowerCase();
}

// Expense/Income models are introduced in a later phase. Until then this count
// is 0, but once those models are registered the guard automatically applies.
async function referenceCount(categoryId) {
  let count = 0;
  try {
    const Expense = mongoose.model('Expense');
    count += await Expense.countDocuments({ categoryId });
  } catch {
    /* model not registered yet */
  }
  try {
    const Income = mongoose.model('Income');
    count += await Income.countDocuments({ categoryId });
  } catch {
    /* model not registered yet */
  }
  return count;
}

export async function seedCategories() {
  const seeds = [
    { type: 'expense', names: ['Road Construction', 'Gutter Work', 'Electricity', 'Water', 'Labor', 'Legal', 'Other'] },
    { type: 'income', names: ['Other Income'] },
  ];

  let created = 0;
  for (const group of seeds) {
    for (const name of group.names) {
      const normalized = normalize(name);
      const existing = await Category.findOne({ type: group.type, normalizedName: normalized });
      if (existing) continue;
      await Category.create({
        name: name.trim(),
        type: group.type,
        isSeed: true,
        active: true,
        normalizedName: normalized,
      });
      created += 1;
    }
  }
  return created;
}

export async function createCategory(body) {
  if (!body.name || !String(body.name).trim()) {
    throw new AppError('Category name is required', 400);
  }
  if (!body.type || !TYPES.includes(body.type)) {
    throw new AppError('Valid category type is required (expense|income)', 400);
  }

  const name = String(body.name).trim();
  const normalized = normalize(name);
  const dup = await Category.findOne({ type: body.type, normalizedName: normalized });
  if (dup) {
    throw new AppError('A category with this name already exists for the selected type', 409);
  }

  const category = await Category.create({
    name,
    type: body.type,
    isSeed: false,
    active: body.active === undefined ? true : Boolean(body.active),
    notes: body.notes || undefined,
    normalizedName: normalized,
  });
  return category;
}

export async function listCategories({ type, active } = {}) {
  const filter = {};
  if (type) {
    if (!TYPES.includes(type)) throw new AppError('Invalid category type filter', 400);
    filter.type = type;
  }
  if (active !== undefined) {
    if (active === 'true' || active === true) filter.active = true;
    else if (active === 'false' || active === false) filter.active = false;
  }

  const items = await Category.find(filter).sort({ type: 1, name: 1 });
  return { items };
}

export async function getCategory(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid category id', 400);
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found', 404);
  return category;
}

export async function updateCategory(id, body) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid category id', 400);
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found', 404);

  const newType = body.type !== undefined ? body.type : category.type;
  const newName = body.name !== undefined ? String(body.name).trim() : category.name;

  if (body.type !== undefined && !TYPES.includes(body.type)) {
    throw new AppError('Valid category type is required (expense|income)', 400);
  }
  if (body.name !== undefined && !newName) {
    throw new AppError('Category name cannot be empty', 400);
  }

  const newNormalized = normalize(newName);
  const dup = await Category.findOne({
    type: newType,
    normalizedName: newNormalized,
    _id: { $ne: id },
  });
  if (dup) {
    throw new AppError('A category with this name already exists for the selected type', 409);
  }

  if (body.name !== undefined) {
    category.name = newName;
    category.normalizedName = newNormalized;
  }
  if (body.type !== undefined) category.type = body.type;
  if (body.active !== undefined) category.active = Boolean(body.active);
  if (body.notes !== undefined) category.notes = body.notes;
  // isSeed is intentionally not editable.

  await category.save();
  return category;
}

export async function deleteCategory(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid category id', 400);
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found', 404);

  const refs = await referenceCount(id);
  if (refs > 0) {
    throw new AppError('Cannot delete category that is referenced by financial records', 409);
  }

  await category.deleteOne();
  return true;
}
