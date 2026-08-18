import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as partnerService from '../services/partner.service.js';

export const create = asyncHandler(async (req, res) => {
  const partner = await partnerService.createPartner(req.body);
  success(res, partner, 'Partner created', 201);
});

export const list = asyncHandler(async (req, res) => {
  const result = await partnerService.listPartners({
    search: req.query.search,
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit,
  });
  success(res, result, 'Partners retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const partner = await partnerService.getPartner(req.params.id);
  success(res, partner, 'Partner retrieved');
});

export const getSummary = asyncHandler(async (req, res) => {
  const summary = await partnerService.getPartnerCapitalSummary(req.params.id);
  success(res, summary, 'Partner capital summary retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const partner = await partnerService.updatePartner(req.params.id, req.body);
  success(res, partner, 'Partner updated');
});

export const remove = asyncHandler(async (req, res) => {
  await partnerService.deletePartner(req.params.id);
  success(res, null, 'Partner deleted');
});
