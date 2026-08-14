import { fail } from '../utils/response.js';

export function notFound(req, res) {
  fail(res, `Not found: ${req.originalUrl}`, 404);
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message =
    err.message || 'Internal Server Error';
  const payload = { success: false, message };
  if (err.details) payload.errors = err.details;
  if (status === 500 && process.env.NODE_ENV === 'production') {
    payload.message = 'Internal Server Error';
  }
  res.status(status).json(payload);
}
