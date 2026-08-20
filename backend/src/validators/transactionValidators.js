import Joi from 'joi';
import {
  PAYMENT_MODES,
  SOURCE_TYPES,
  TRANSACTION_TYPES,
} from '../config/constants.js';
import { dateStringSchema, publicIdSchema, dateOrderCheck } from './common.js';

const amountSchema = Joi.number().positive().precision(2).max(999999999999).required();

export const createTransactionSchema = Joi.object({
  transactionType: Joi.string().valid(...Object.values(TRANSACTION_TYPES)).required(),
  sourceType: Joi.string().valid(...Object.values(SOURCE_TYPES)).optional(),
  customerPublicId: Joi.when('sourceType', {
    is: SOURCE_TYPES.CUSTOMER,
    then: publicIdSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  partnerPublicId: Joi.when('sourceType', {
    is: Joi.valid(SOURCE_TYPES.PARTNER_CAPITAL, SOURCE_TYPES.PARTNER_LOAN).required(),
    then: publicIdSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  categoryPublicId: Joi.when('transactionType', {
    is: TRANSACTION_TYPES.OUTTAKE,
    then: publicIdSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  amount: amountSchema,
  paymentMode: Joi.string().valid(...PAYMENT_MODES).required(),
  transactionDate: dateStringSchema.required(),
  referenceNumber: Joi.string().trim().max(100).allow('').allow(null).optional(),
  plotNumber: Joi.string().trim().max(50).allow('').allow(null).optional(),
  paidTo: Joi.string().trim().max(150).allow('').allow(null).optional(),
  description: Joi.string().trim().max(2000).allow('').allow(null).optional(),
});

export const listTransactionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(200).allow('').optional(),
  type: Joi.string().valid(...Object.values(TRANSACTION_TYPES)).optional(),
  sourceType: Joi.string().valid(...Object.values(SOURCE_TYPES)).optional(),
  customerId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
  partnerId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
  categoryId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).custom(dateOrderCheck);

const optionalAmountSchema = Joi.number().positive().precision(2).max(999999999999).optional();

export const updateTransactionSchema = Joi.object({
  transactionType: Joi.string().valid(...Object.values(TRANSACTION_TYPES)).optional(),
  sourceType: Joi.string().valid(...Object.values(SOURCE_TYPES)).optional(),
  customerPublicId: Joi.when('sourceType', {
    is: SOURCE_TYPES.CUSTOMER,
    then: publicIdSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  partnerPublicId: Joi.when('sourceType', {
    is: Joi.valid(SOURCE_TYPES.PARTNER_CAPITAL, SOURCE_TYPES.PARTNER_LOAN).required(),
    then: publicIdSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  categoryPublicId: Joi.when('transactionType', {
    is: TRANSACTION_TYPES.OUTTAKE,
    then: publicIdSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  amount: optionalAmountSchema,
  paymentMode: Joi.string().valid(...PAYMENT_MODES).optional(),
  transactionDate: dateStringSchema.optional(),
  referenceNumber: Joi.string().trim().max(100).allow('').allow(null).optional(),
  plotNumber: Joi.string().trim().max(50).allow('').allow(null).optional(),
  paidTo: Joi.string().trim().max(150).allow('').allow(null).optional(),
  description: Joi.string().trim().max(2000).allow('').allow(null).optional(),
}).min(1);

export const destructiveTransactionSchema = Joi.object({
  adminPassword: Joi.string().min(1).max(128).required(),
  reason: Joi.string().trim().max(1000).allow('').allow(null).optional(),
});

export const reverseTransactionSchema = Joi.object({
  adminPassword: Joi.string().min(1).max(128).required(),
  reason: Joi.string().trim().max(1000).allow('').allow(null).optional(),
});