export const ROLES = Object.freeze({
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
});

export const ROLE_LIST = Object.values(ROLES);

export const PAYMENT_MODES = Object.freeze(['cash', 'cheque', 'upi', 'bank_transfer']);

export const TRANSACTION_TYPES = Object.freeze({
  INTAKE: 'intake',
  OUTTAKE: 'outtake',
});

export const SOURCE_TYPES = Object.freeze({
  CUSTOMER: 'customer',
  PARTNER_CAPITAL: 'partner_capital',
  PARTNER_LOAN: 'partner_loan',
});

export const AUDIT_ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  REVERSE: 'reverse',
  LOGIN: 'login',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  REFRESH: 'refresh',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET: 'password_reset',
  SETTINGS_UPDATE: 'settings_update',
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DEACTIVATE: 'user_deactivate',
  USER_ACTIVATE: 'user_activate',
});

// Account lockout policy: 5 consecutive failures -> ~15 minute lockout
export const LOCKOUT = Object.freeze({
  MAX_ATTEMPTS: 5,
  DURATION_MS: 15 * 60 * 1000,
});

// Rate limits (requests per window)
export const RATE_LIMITS = Object.freeze({
  AUTH: { windowMs: 15 * 60 * 1000, max: 20 },
  GENERAL: { windowMs: 15 * 60 * 1000, max: 300 },
});

// Duplicate detection window (created within X ms of a matching record)
export const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export const FINANCIAL_YEAR_START_MONTH = 4;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;