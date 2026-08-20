import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../config/constants.js';

export function authLimiter() {
  return rateLimit({
    windowMs: RATE_LIMITS.AUTH.windowMs,
    limit: RATE_LIMITS.AUTH.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    },
  });
}

export function generalLimiter() {
  return rateLimit({
    windowMs: RATE_LIMITS.GENERAL.windowMs,
    limit: RATE_LIMITS.GENERAL.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    },
  });
}