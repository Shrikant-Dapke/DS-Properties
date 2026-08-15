import { success } from '../utils/response.js';
import * as dashboardService from '../services/dashboard.service.js';

export async function summary(req, res, next) {
  try {
    const data = await dashboardService.getDashboardSummary({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });
    success(res, data, 'Dashboard summary retrieved');
  } catch (err) {
    next(err);
  }
}

export async function trends(req, res, next) {
  try {
    const data = await dashboardService.getDashboardTrends({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      granularity: req.query.granularity || 'month',
    });
    success(res, data, 'Dashboard trends retrieved');
  } catch (err) {
    next(err);
  }
}

export async function recent(req, res, next) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const data = await dashboardService.getDashboardRecentActivity(limit);
    success(res, data, 'Recent activity retrieved');
  } catch (err) {
    next(err);
  }
}
