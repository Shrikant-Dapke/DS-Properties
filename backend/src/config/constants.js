export const ROLES = Object.freeze({
  ADMIN: 'admin',
  READ_ONLY: 'read_only',
});

export const ROLE_LIST = Object.values(ROLES);

// Entity types that may be governed by a change request. This is an explicit
// allow-list — arbitrary table/entity names from user input are rejected.
export const GOVERNANCE_ENTITY_TYPES = Object.freeze([
  'transaction',
  'customer',
  'partner',
  'category',
  'user',
  'app_setting',
]);

// Operations that a change request may represent.
export const GOVERNANCE_OPERATIONS = Object.freeze([
  'create',
  'update',
  'delete',
  'reverse',
]);

export const CHANGE_REQUEST_STATUSES = Object.freeze([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

export const APPROVAL_STATUSES = Object.freeze(['APPROVED', 'REJECTED']);

// Users in this role are "sensitive": creating, promoting to, demoting from,
// or deactivating an admin is a governed (multi-admin-approved) operation.
export const SENSITIVE_ROLE = ROLES.ADMIN;

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