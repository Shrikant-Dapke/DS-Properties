export function parsePage(page) {
  const parsed = Number.parseInt(page, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

export function parseLimit(limit, max = 100, fallback = 20) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function buildPagination(page, limit, total) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function offset(page, limit) {
  return (page - 1) * limit;
}