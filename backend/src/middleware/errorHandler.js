import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/environment.js';

export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details;

  // PostgreSQL error translation
  if (err.code) {
    if (err.code === '23505') {
      statusCode = 409;
      code = 'CONFLICT';
      message = 'A record with the same unique value already exists';
    } else if (err.code === '23503') {
      statusCode = 409;
      code = 'REFERENCE_IN_USE';
      message = 'This record is referenced by other data and cannot be changed';
    } else if (err.code === '23514') {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      message = 'Data violates a business rule';
    } else if (err.code === '22P02' || err.code === '22007') {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      message = 'Malformed value supplied';
    }
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Malformed JSON body';
  }

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }

  if (statusCode >= 500) {
    logger.error({ err, reqUrl: req.originalUrl }, 'Unhandled error');
  } else {
    logger.warn({ err, reqUrl: req.originalUrl }, 'Request error');
  }

  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  if (config.isProd && statusCode >= 500) body.error.message = 'Internal server error';

  res.status(statusCode).json(body);
}