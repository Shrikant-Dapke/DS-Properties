import {
  getDailyReport,
  getMonthlyReport,
  getCategoryReport,
  getPartnerFinancialReport,
} from '../services/reportService.js';
import { parsePage, parseLimit, offset } from '../utils/pagination.js';

export async function dailyReport(req, res) {
  const data = await getDailyReport({ date: req.query.date });
  res.json({ success: true, data });
}

export async function monthlyReport(req, res) {
  const data = await getMonthlyReport({ year: req.query.year, month: req.query.month });
  res.json({ success: true, data });
}

export async function categoryReport(req, res) {
  const data = await getCategoryReport({ from: req.query.from, to: req.query.to });
  res.json({ success: true, data });
}

export async function partnerReport(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const data = await getPartnerFinancialReport(req.params.id, {
    page,
    limit,
    offset: offset(page, limit),
  });
  res.json({ success: true, data });
}