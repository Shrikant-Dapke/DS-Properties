import { AppError } from './errors.js';

export function dateRangeFilter(dateFrom, dateTo) {
  const range = {};
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (isNaN(d.getTime())) throw new AppError('Invalid dateFrom', 400);
    range.$gte = d;
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (isNaN(d.getTime())) throw new AppError('Invalid dateTo', 400);
    range.$lte = d;
  }
  return Object.keys(range).length ? range : null;
}

export function pageMeta(page, limit, total, { max = 100, fallback = 20 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(max, Math.max(1, parseInt(limit, 10) || fallback));
  const skip = (pageNum - 1) * limitNum;
  return { page: pageNum, limitNum, skip, total, totalPages: Math.ceil(total / limitNum) };
}

export function pickFields(body, allowed) {
  const data = {};
  for (const field of allowed) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}
