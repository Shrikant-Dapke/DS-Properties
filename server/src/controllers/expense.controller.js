import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as expenseService from '../services/expense.service.js';

export const create = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.body);
  success(res, expense, 'Expense recorded', 201);
});

export const list = asyncHandler(async (req, res) => {
  const includeDeleted = req.query.deleted === 'all' || req.query.includeDeleted === 'true';
  const result = await expenseService.listExpenses({
    category: req.query.category,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    page: req.query.page,
    limit: req.query.limit,
    includeDeleted,
  });
  success(res, result, 'Expenses retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const includeDeleted = req.query.deleted === 'all' || req.query.includeDeleted === 'true';
  const expense = await expenseService.getExpense(req.params.id, { includeDeleted });
  success(res, expense, 'Expense retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.params.id, req.body);
  success(res, expense, 'Expense updated');
});

export const remove = asyncHandler(async (req, res) => {
  const expense = await expenseService.softDeleteExpense(req.params.id);
  success(res, expense, 'Expense deleted (soft)');
});
