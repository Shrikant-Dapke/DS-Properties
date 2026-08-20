import { getAllSettings, getSetting, upsertSetting } from '../models/settingsModel.js';
import { getOpeningBalance } from '../models/settingsModel.js';
import { invalidateFinancialCache } from '../utils/cache.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logAudit } from './auditService.js';

const NUMERIC_KEYS = new Set(['opening_balance', 'financial_year_start_month']);

function parseStored(row) {
  let value;
  try {
    value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  } catch {
    value = row.value;
  }
  return {
    key: row.key,
    value,
    description: row.description,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by_username,
  };
}

export async function listSettings() {
  const rows = await getAllSettings();
  return rows.map(parseStored);
}

export async function updateSetting(key, rawValue, ctx) {
  const existing = await getSetting(key);
  if (!existing) throw new NotFoundError('Setting not found');

  let value = rawValue;
  if (NUMERIC_KEYS.has(key)) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) throw new ValidationError(`${key} must be a number`);
    value = num;
  }

  if (key === 'opening_balance' && Number(value) < 0) {
    throw new ValidationError('Opening balance cannot be negative');
  }

  const row = await upsertSetting(key, value, undefined, ctx.userId);

  if (key === 'opening_balance') {
    invalidateFinancialCache();
  }

  await logAudit({
    userId: ctx.userId,
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    domain: 'app_settings',
    recordId: key,
    oldValues: { [key]: existing.value },
    newValues: { [key]: value },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return parseStored(row);
}

export { getOpeningBalance };