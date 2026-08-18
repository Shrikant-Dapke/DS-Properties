import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as dashboardService from '../services/dashboard.service.js';

export const summary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardSummary({
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
  });
  success(res, data, 'Dashboard summary retrieved');
});

export const trends = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardTrends({
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    granularity: req.query.granularity || 'month',
  });
  success(res, data, 'Dashboard trends retrieved');
});

export const recent = asyncHandler(async (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
  const data = await dashboardService.getDashboardRecentActivity(limit);
  success(res, data, 'Recent activity retrieved');
});
