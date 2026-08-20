import {
  getDashboardSummary,
  getCategoryBreakdown,
} from '../services/dashboardService.js';

export async function dashboardSummary(req, res) {
  const data = await getDashboardSummary({
    from: req.query.from,
    to: req.query.to,
  });
  res.json({ success: true, data });
}

export async function categoryBreakdown(req, res) {
  const data = await getCategoryBreakdown({
    from: req.query.from,
    to: req.query.to,
  });
  res.json({ success: true, data });
}