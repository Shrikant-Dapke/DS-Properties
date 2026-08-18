import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as customerService from '../services/customer.service.js';

export const create = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.body);
  success(res, customer, 'Customer created', 201);
});

export const list = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomers({
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
  });
  success(res, result, 'Customers retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomer(req.params.id);
  success(res, customer, 'Customer retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body);
  success(res, customer, 'Customer updated');
});

export const remove = asyncHandler(async (req, res) => {
  await customerService.deleteCustomer(req.params.id);
  success(res, null, 'Customer deleted');
});
