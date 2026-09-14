import {
  listCategories,
  findAllActiveCategories,
  findCategoryByPublicId,
  findCategoryById,
  createCategory,
  updateCategory,
  softDeleteCategory,
  countCategoryTransactions,
} from '../models/categoryModel.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { logAudit } from './auditService.js';

function versionOf(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function assertFresh(row, expectedVersion) {
  if (expectedVersion === undefined || expectedVersion === null || expectedVersion === '') return;
  if (versionOf(row.updated_at) !== String(expectedVersion)) {
    throw new ConflictError('Category changed since you loaded it', 'STALE_CONFLICT');
  }
}

function serialize(cat) {
  return {
    publicId: cat.public_id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    isActive: cat.is_active,
    sortOrder: cat.sort_order,
    createdAt: cat.created_at,
    updatedAt: cat.updated_at,
    // Optimistic-concurrency source: clients read versionTag (or updatedAt)
    // from GET and echo it back as versionTag on update. Absent tags proceed
    // untouched so existing clients keep working.
    versionTag: versionOf(cat.updated_at),
  };
}

export async function listAllCategories({ activeOnly, page, limit, offset }) {
  const { total, rows } = await listCategories({ activeOnly, page, limit, offset });
  return { total, rows: rows.map(serialize) };
}

export async function listActiveCategories() {
  const rows = await findAllActiveCategories();
  return rows.map(serialize);
}

export async function getCategory(publicId) {
  const row = await findCategoryByPublicId(publicId);
  if (!row) throw new NotFoundError('Category not found');
  const cat = await findCategoryById(row.id);
  return serialize(cat);
}

export async function createNewCategory(data, ctx) {
  const cat = await createCategory({
    name: data.name,
    slug: data.slug,
    description: data.description,
    sortOrder: data.sortOrder,
  }).catch((err) => {
    if (err.code === '23505') throw new ConflictError('Category slug already exists', 'SLUG_TAKEN');
    throw err;
  });

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.CREATE,
    domain: 'expense_categories',
    recordId: cat.public_id,
    newValues: { name: cat.name, slug: cat.slug },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(cat);
}

export async function updateExistingCategory(publicId, data, ctx) {
  const row = await findCategoryByPublicId(publicId);
  if (!row) throw new NotFoundError('Category not found');
  const before = await findCategoryById(row.id);
  // Optimistic concurrency: callers may pass the versionTag they read;
  // absent tags (direct path) proceed untouched. The tag is never a column.
  assertFresh(before, data?.versionTag ?? data?.expectedVersion);

  const fields = {};
  const columnMap = {
    name: 'name',
    slug: 'slug',
    description: 'description',
    sortOrder: 'sort_order',
    isActive: 'is_active',
  };
  for (const [k, v] of Object.entries(data ?? {})) {
    if (k === 'versionTag' || k === 'expectedVersion') continue;
    if (!(k in columnMap)) continue;
    fields[columnMap[k]] = v;
  }
  if (Object.keys(fields).length === 0) {
    throw new ValidationError('No valid fields to update');
  }
  const cat = await updateCategory(row.id, fields).catch((err) => {
    if (err.code === '23505') throw new ConflictError('Category slug already exists', 'SLUG_TAKEN');
    throw err;
  });

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.UPDATE,
    domain: 'expense_categories',
    recordId: cat.public_id,
    oldValues: { name: before.name, slug: before.slug, isActive: before.is_active },
    newValues: fields,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return serialize(cat);
}

export async function deleteCategory(publicId, ctx) {
  const row = await findCategoryByPublicId(publicId);
  if (!row) throw new NotFoundError('Category not found');

  const txCount = await countCategoryTransactions(row.id);
  if (txCount > 0) {
    throw new ConflictError(
      'Category is referenced by transactions; deactivate it instead of deleting',
      'HAS_TRANSACTIONS',
    );
  }

  const cat = await softDeleteCategory(row.id);

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.DELETE,
    domain: 'expense_categories',
    recordId: cat.public_id,
    newValues: { name: cat.name },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { success: true };
}