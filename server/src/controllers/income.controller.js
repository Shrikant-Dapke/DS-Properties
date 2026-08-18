import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as incomeService from '../services/income.service.js';

export const create = asyncHandler(async (req, res) => {
  const income = await incomeService.createIncome(req.body);
  success(res, income, 'Income recorded', 201);
});

export const list = asyncHandler(async (req, res) => {
  const result = await incomeService.listIncome({
    category: req.query.category,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    page: req.query.page,
    limit: req.query.limit,
  });
  success(res, result, 'Income retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const income = await incomeService.getIncome(req.params.id);
  success(res, income, 'Income retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const income = await incomeService.updateIncome(req.params.id, req.body);
  success(res, income, 'Income updated');
});
