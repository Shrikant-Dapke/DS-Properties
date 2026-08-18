import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as reportService from '../services/report.service.js';
import { AppError } from '../utils/errors.js';

export const listTypes = asyncHandler(async (req, res) => {
  success(res, { types: reportService.getReportTypes() }, 'Report types retrieved');
});

export const generate = asyncHandler(async (req, res) => {
  const report = await reportService.buildReport(req.params.type, req.query, { paginate: true });
  success(res, report, 'Report generated');
});

export const exportFile = asyncHandler(async (req, res) => {
  const format = (req.query.format || '').toLowerCase();
  if (!['pdf', 'excel', 'csv'].includes(format)) {
    throw new AppError('Export format must be pdf, excel, or csv', 400);
  }
  const result = await reportService.exportReport(req.params.type, req.query, format);
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  if (typeof result.content === 'string') {
    res.send(result.content);
  } else {
    res.send(Buffer.from(result.content));
  }
});
