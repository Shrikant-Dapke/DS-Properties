import { success } from '../utils/response.js';
import * as categoryService from '../services/category.service.js';

export async function create(req, res, next) {
  try {
    const category = await categoryService.createCategory(req.body);
    success(res, category, 'Category created', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await categoryService.listCategories(req.query);
    success(res, result, 'Categories retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const category = await categoryService.getCategory(req.params.id);
    success(res, category, 'Category retrieved');
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    success(res, category, 'Category updated');
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await categoryService.deleteCategory(req.params.id);
    success(res, null, 'Category deleted');
  } catch (err) {
    next(err);
  }
}
