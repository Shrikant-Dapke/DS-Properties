import {
  listAllCategories,
  listActiveCategories as listActiveCategoriesService,
  getCategory,
  createNewCategory,
  updateExistingCategory,
  deleteCategory as deleteCategoryService,
} from '../services/categoryService.js';
import { parsePage, parseLimit, offset, buildPagination } from '../utils/pagination.js';
import { buildContext } from './context.js';

export async function listCategories(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { total, rows } = await listAllCategories({
    activeOnly: req.query.activeOnly,
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data: { rows, pagination: buildPagination(page, limit, total) } });
}

export async function listActiveCategories(req, res) {
  const rows = await listActiveCategoriesService();
  res.json({ success: true, data: rows });
}

export async function getCategoryById(req, res) {
  const category = await getCategory(req.params.id);
  res.json({ success: true, data: category });
}

export async function createCategory(req, res) {
  const ctx = buildContext(req);
  const category = await createNewCategory(req.body, ctx);
  res.status(201).json({ success: true, data: category });
}

export async function updateCategory(req, res) {
  const ctx = buildContext(req);
  const category = await updateExistingCategory(req.params.id, req.body, ctx);
  res.json({ success: true, data: category });
}

export async function deleteCategory(req, res) {
  const ctx = buildContext(req);
  const result = await deleteCategoryService(req.params.id, ctx);
  res.json({ success: true, data: result });
}