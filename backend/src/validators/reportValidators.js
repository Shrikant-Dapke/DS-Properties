import Joi from 'joi';
import {
  dateStringSchema,
  dateOrderCheck,
  dateRangePresenceCheck,
  requiredDateRangeSchema,
} from './common.js';

export const dailyReportQuerySchema = Joi.object({
  date: dateStringSchema.required(),
});

// Monthly report accepts either year+month (legacy) or an explicit inclusive
// from/to range (weekly / yearly / custom periods). When from/to are present
// they take precedence.
export const monthlyReportQuerySchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).custom((value, helpers) => {
  if (value.from || value.to) {
    return dateRangePresenceCheck(value, helpers);
  }
  if (value.year == null || value.month == null) {
    return helpers.message('Either year+month or from+to is required');
  }
  return value;
});

export const rangeReportQuerySchema = requiredDateRangeSchema;

export const partnerReportQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).custom(dateOrderCheck);

export const updateSettingSchema = Joi.object({
  value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
  ).required(),
  description: Joi.string().trim().max(500).allow('').allow(null).optional(),
});