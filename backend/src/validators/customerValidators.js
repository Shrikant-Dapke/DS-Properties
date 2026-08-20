import Joi from 'joi';

export const createCustomerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  phone: Joi.string().trim().max(30).allow('').allow(null).optional(),
  email: Joi.string().email().max(200).allow('').allow(null).optional(),
  address: Joi.string().trim().max(500).allow('').allow(null).optional(),
  notes: Joi.string().trim().max(2000).allow('').allow(null).optional(),
});

export const updateCustomerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).optional(),
  phone: Joi.string().trim().max(30).allow('').allow(null).optional(),
  email: Joi.string().email().max(200).allow('').allow(null).optional(),
  address: Joi.string().trim().max(500).allow('').allow(null).optional(),
  notes: Joi.string().trim().max(2000).allow('').allow(null).optional(),
}).min(1);

export const listCustomerQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(200).allow('').optional(),
});