import { success } from '../utils/response.js';
import * as capitalService from '../services/capital.service.js';

export async function create(req, res, next) {
  try {
    const capital = await capitalService.createCapital(req.body);
    success(res, capital, 'Capital contribution recorded', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await capitalService.listCapital({
      partner: req.query.partner,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      limit: req.query.limit,
    });
    success(res, result, 'Capital contributions retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const capital = await capitalService.getCapital(req.params.id);
    success(res, capital, 'Capital contribution retrieved');
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const capital = await capitalService.updateCapital(req.params.id, req.body);
    success(res, capital, 'Capital contribution updated');
  } catch (err) {
    next(err);
  }
}
