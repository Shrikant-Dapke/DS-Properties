import {
  listTransactions,
  getFinanceSummary,
} from '../services/finance.service.js';
import { success } from '../utils/response.js';

export async function list(req, res, next) {
  try {
    const data = await listTransactions(req.query);
    success(res, data, 'Transactions retrieved');
  } catch (err) {
    next(err);
  }
}

export async function moneyIn(req, res, next) {
  try {
    const data = await listTransactions({ ...req.query, direction: 'in' });
    success(res, data, 'Money in retrieved');
  } catch (err) {
    next(err);
  }
}

export async function moneyOut(req, res, next) {
  try {
    const data = await listTransactions({ ...req.query, direction: 'out' });
    success(res, data, 'Money out retrieved');
  } catch (err) {
    next(err);
  }
}

export async function summary(req, res, next) {
  try {
    const data = await getFinanceSummary();
    success(res, data, 'Finance summary retrieved');
  } catch (err) {
    next(err);
  }
}
