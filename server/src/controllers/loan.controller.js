import { success } from '../utils/response.js';
import * as loanService from '../services/loan.service.js';

export async function create(req, res, next) {
  try {
    const loan = await loanService.createLoan(req.body);
    success(res, loan, 'Loan received recorded', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await loanService.listLoans({
      lender: req.query.lender,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      limit: req.query.limit,
    });
    success(res, result, 'Loans received retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const loan = await loanService.getLoan(req.params.id);
    success(res, loan, 'Loan retrieved');
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const loan = await loanService.updateLoan(req.params.id, req.body);
    success(res, loan, 'Loan updated');
  } catch (err) {
    next(err);
  }
}
