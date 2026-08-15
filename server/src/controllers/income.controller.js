import { success } from '../utils/response.js';
import * as incomeService from '../services/income.service.js';

export async function create(req, res, next) {
  try {
    const income = await incomeService.createIncome(req.body);
    success(res, income, 'Income recorded', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await incomeService.listIncome({
      category: req.query.category,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      limit: req.query.limit,
    });
    success(res, result, 'Income retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const income = await incomeService.getIncome(req.params.id);
    success(res, income, 'Income retrieved');
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const income = await incomeService.updateIncome(req.params.id, req.body);
    success(res, income, 'Income updated');
  } catch (err) {
    next(err);
  }
}
