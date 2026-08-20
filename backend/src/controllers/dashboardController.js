import {
  getDashboardSummary,
  getCategoryBreakdown,
} from '../services/dashboardService.js';

export async function dashboardSummary(req, res) {
  const data = await getDashboardSummary();
  res.json({ success: true, data });
}

export async function categoryBreakdown(req, res) {
  const data = await getCategoryBreakdown();
  res.json({ success: true, data });
}