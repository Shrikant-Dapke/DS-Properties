import { success } from '../utils/response.js';
import * as customerService from '../services/customer.service.js';

export async function create(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.body);
    success(res, customer, 'Customer created', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await customerService.listCustomers({
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    success(res, result, 'Customers retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const customer = await customerService.getCustomer(req.params.id);
    success(res, customer, 'Customer retrieved');
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const customer = await customerService.updateCustomer(req.params.id, req.body);
    success(res, customer, 'Customer updated');
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await customerService.deleteCustomer(req.params.id);
    success(res, null, 'Customer deleted');
  } catch (err) {
    next(err);
  }
}
