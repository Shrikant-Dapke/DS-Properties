import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as loanService from '../services/loan.service.js';

export const create = asyncHandler(async (req, res) => {
  const loan = await loanService.createLoan(req.body);
  success(res, loan, 'Loan received recorded', 201);
});

export const list = asyncHandler(async (req, res) => {
  const result = await loanService.listLoans({
    lender: req.query.lender,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    page: req.query.page,
    limit: req.query.limit,
  });
  success(res, result, 'Loans received retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const loan = await loanService.getLoan(req.params.id);
  success(res, loan, 'Loan retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const loan = await loanService.updateLoan(req.params.id, req.body);
  success(res, loan, 'Loan updated');
});
