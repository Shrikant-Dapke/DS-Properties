import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as categoryService from '../services/category.service.js';

export const create = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  success(res, category, 'Category created', 201);
});

export const list = asyncHandler(async (req, res) => {
  const result = await categoryService.listCategories(req.query);
  success(res, result, 'Categories retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategory(req.params.id);
  success(res, category, 'Category retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  success(res, category, 'Category updated');
});

export const remove = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  success(res, null, 'Category deleted');
});
