import { listTransactions, getFinanceSummary } from '../services/finance.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const data = await listTransactions(req.query);
  success(res, data, 'Transactions retrieved');
});

export const moneyIn = asyncHandler(async (req, res) => {
  const data = await listTransactions({ ...req.query, direction: 'in' });
  success(res, data, 'Money in retrieved');
});

export const moneyOut = asyncHandler(async (req, res) => {
  const data = await listTransactions({ ...req.query, direction: 'out' });
  success(res, data, 'Money out retrieved');
});

export const summary = asyncHandler(async (req, res) => {
  const data = await getFinanceSummary();
  success(res, data, 'Finance summary retrieved');
});
