import { success } from '../utils/response.js';
import * as paymentService from '../services/payment.service.js';

export async function create(req, res, next) {
  try {
    const payment = await paymentService.createPayment(req.body);
    success(res, payment, 'Payment recorded', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await paymentService.listPayments(req.query);
    success(res, result, 'Payments retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const payment = await paymentService.getPayment(req.params.id);
    success(res, payment, 'Payment retrieved');
  } catch (err) {
    next(err);
  }
}
