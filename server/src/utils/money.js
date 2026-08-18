import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import { AppError } from './errors.js';

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

export function toDecimal128(value) {
  if (value === null || value === undefined) return null;
  return mongoose.Types.Decimal128.fromString(new Decimal(value.toString()).toString());
}

export function parseAmount(raw, label) {
  const subject = label || 'Amount';
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new AppError(`${subject} is required`, 400);
  }
  let amount;
  try {
    amount = new Decimal(String(raw).trim());
  } catch {
    throw new AppError(`Invalid ${subject.toLowerCase()}`, 400);
  }
  if (!amount.isFinite() || amount.lte(0)) {
    throw new AppError(`${subject} must be greater than zero`, 400);
  }
  return amount;
}

export function parseDate(raw, label) {
  const subject = label || 'Date';
  if (!raw) throw new AppError(`${subject} is required`, 400);
  const date = new Date(raw);
  if (isNaN(date.getTime())) throw new AppError(`Invalid ${subject.toLowerCase()}`, 400);
  return date;
}
