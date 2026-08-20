import Joi from 'joi';

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  slug: Joi.string().trim().min(1).max(100)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .required()
    .messages({ 'string.pattern.base': 'Slug must be lowercase with dashes (e.g. road-construction)' }),
  description: Joi.string().trim().max(500).allow('').allow(null).optional(),
  sortOrder: Joi.number().integer().min(0).max(10000).optional(),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  slug: Joi.string().trim().min(1).max(100)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .messages({ 'string.pattern.base': 'Slug must be lowercase with dashes (e.g. road-construction)' }),
  description: Joi.string().trim().max(500).allow('').allow(null).optional(),
  sortOrder: Joi.number().integer().min(0).max(10000).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

export const listCategoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  activeOnly: Joi.boolean().optional().default(false),
});