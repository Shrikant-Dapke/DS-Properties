import { success } from '../utils/response.js';
import * as expenseService from '../services/expense.service.js';

export async function create(req, res, next) {
  try {
    const expense = await expenseService.createExpense(req.body);
    success(res, expense, 'Expense recorded', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
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
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const includeDeleted = req.query.deleted === 'all' || req.query.includeDeleted === 'true';
    const expense = await expenseService.getExpense(req.params.id, { includeDeleted });
    success(res, expense, 'Expense retrieved');
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const expense = await expenseService.updateExpense(req.params.id, req.body);
    success(res, expense, 'Expense updated');
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const expense = await expenseService.softDeleteExpense(req.params.id);
    success(res, expense, 'Expense deleted (soft)');
  } catch (err) {
    next(err);
  }
}
