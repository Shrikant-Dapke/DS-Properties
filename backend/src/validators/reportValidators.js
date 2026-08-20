import Joi from 'joi';
import { dateStringSchema } from './common.js';

export const dailyReportQuerySchema = Joi.object({
  date: dateStringSchema.required(),
});

export const monthlyReportQuerySchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
});

export const rangeReportQuerySchema = Joi.object({
  from: dateStringSchema.required(),
  to: dateStringSchema.required(),
});

export const updateSettingSchema = Joi.object({
  value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
  ).required(),
  description: Joi.string().trim().max(500).allow('').allow(null).optional(),
});