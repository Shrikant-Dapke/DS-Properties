import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as paymentService from '../services/payment.service.js';

export const create = asyncHandler(async (req, res) => {
  const payment = await paymentService.createPayment(req.body);
  success(res, payment, 'Payment recorded', 201);
});

export const list = asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments(req.query);
  success(res, result, 'Payments retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPayment(req.params.id);
  success(res, payment, 'Payment retrieved');
});
