import { success } from '../utils/response.js';
import * as partnerService from '../services/partner.service.js';

export async function create(req, res, next) {
  try {
    const partner = await partnerService.createPartner(req.body);
    success(res, partner, 'Partner created', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await partnerService.listPartners({
      search: req.query.search,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    success(res, result, 'Partners retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const partner = await partnerService.getPartner(req.params.id);
    success(res, partner, 'Partner retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req, res, next) {
  try {
    const summary = await partnerService.getPartnerCapitalSummary(req.params.id);
    success(res, summary, 'Partner capital summary retrieved');
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const partner = await partnerService.updatePartner(req.params.id, req.body);
    success(res, partner, 'Partner updated');
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await partnerService.deletePartner(req.params.id);
    success(res, null, 'Partner deleted');
  } catch (err) {
    next(err);
  }
}
