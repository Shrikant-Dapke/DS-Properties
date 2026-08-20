import Joi from 'joi';

export const publicIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const publicIdSchema = Joi.string().uuid({ version: 'uuidv4' }).required();

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(200).allow('').optional(),
});

export const dateStringSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .messages({ 'string.pattern.base': 'Date must be in YYYY-MM-DD format' });

// Cross-field checks for from/to query parameters. Used by list endpoints
// (single-sided ranges stay legal) and range endpoints (both sides required).
export function dateOrderCheck(value, helpers) {
  if (value.from && value.to && value.from > value.to) {
    return helpers.message('From date must not be after To date');
  }
  return value;
}

export function dateRangePresenceCheck(value, helpers) {
  if (Boolean(value.from) !== Boolean(value.to)) {
    return helpers.message('Both from and to dates are required');
  }
  return dateOrderCheck(value, helpers);
}

// Optional inclusive date range: both sides or neither.
export const optionalDateRangeSchema = Joi.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).custom(dateRangePresenceCheck);

// Required inclusive date range (both sides mandatory).
export const requiredDateRangeSchema = Joi.object({
  from: dateStringSchema.required(),
  to: dateStringSchema.required(),
}).custom(dateOrderCheck);