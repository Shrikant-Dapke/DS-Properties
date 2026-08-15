import { success } from '../utils/response.js';
import * as reportService from '../services/report.service.js';
import { AppError } from '../utils/errors.js';

export async function listTypes(req, res, next) {
  try {
    success(res, { types: reportService.getReportTypes() }, 'Report types retrieved');
  } catch (err) {
    next(err);
  }
}

export async function generate(req, res, next) {
  try {
    const report = await reportService.buildReport(req.params.type, req.query, { paginate: true });
    success(res, report, 'Report generated');
  } catch (err) {
    next(err);
  }
}

export async function exportFile(req, res, next) {
  try {
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
  } catch (err) {
    next(err);
  }
}
