export const ROLES = Object.freeze({
  ADMIN: 'admin',
  READ_ONLY: 'read_only',
});

export const ROLE_LABELS = Object.freeze({
  admin: 'Admin',
  read_only: 'Read only',
});

export const PAYMENT_MODES = Object.freeze([
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]);

export const TRANSACTION_TYPES = Object.freeze({
  INTAKE: 'intake',
  OUTTAKE: 'outtake',
});

export const SOURCE_TYPES = Object.freeze({
  CUSTOMER: 'customer',
  PARTNER_CAPITAL: 'partner_capital',
  PARTNER_LOAN: 'partner_loan',
});

export const SOURCE_LABELS = Object.freeze({
  customer: 'Customer Receipt',
  partner_capital: 'Partner Capital',
  partner_loan: 'Partner Loan',
});

export const DATE_TODAY = () => new Date().toISOString().slice(0, 10);

export const FINANCIAL_YEAR_START_MONTH = 4; // April — matches the backend