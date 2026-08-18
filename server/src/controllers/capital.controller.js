import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as capitalService from '../services/capital.service.js';

export const create = asyncHandler(async (req, res) => {
  const capital = await capitalService.createCapital(req.body);
  success(res, capital, 'Capital contribution recorded', 201);
});

export const list = asyncHandler(async (req, res) => {
  const result = await capitalService.listCapital({
    partner: req.query.partner,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    page: req.query.page,
    limit: req.query.limit,
  });
  success(res, result, 'Capital contributions retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const capital = await capitalService.getCapital(req.params.id);
  success(res, capital, 'Capital contribution retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const capital = await capitalService.updateCapital(req.params.id, req.body);
  success(res, capital, 'Capital contribution updated');
});
