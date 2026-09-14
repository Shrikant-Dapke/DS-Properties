import Joi from 'joi';
import { API_ASSIGNABLE_ROLES } from '../config/constants.js';
import { publicIdSchema } from './common.js';
import { createPartnerSchema } from './partnerValidators.js';

export const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(8).max(128).required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(8).max(128).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

export const createUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50)
    .pattern(/^[a-zA-Z0-9_.-]+$/)
    .required()
    .messages({ 'string.pattern.base': 'Username may contain only letters, numbers, dots, dashes and underscores' }),
  password: Joi.string().min(8).max(128).required(),
  fullName: Joi.string().trim().min(1).max(150).required(),
  email: Joi.string().email().max(200).allow('').allow(null).optional(),
  phone: Joi.string().trim().max(30).allow('').allow(null).optional(),
  role: Joi.string().valid(...API_ASSIGNABLE_ROLES).required(),
  // Business-partner identity link (partner public id). The service layer
  // enforces: required for role 'partner', forbidden for other roles.
  partnerPublicId: publicIdSchema.allow(null).optional(),
  // Inline partner creation for onboarding a brand-new partner together with
  // their login (single atomic request). Validated by the exact same schema
  // the Partners module uses; allowed only for role 'partner', forbidden for
  // every other role. The service layer additionally rejects combining this
  // with partnerPublicId.
  newPartner: Joi.when('role', {
    is: 'partner',
    then: createPartnerSchema.optional(),
    otherwise: Joi.forbidden(),
  }),
});

export const updateUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50)
    .pattern(/^[a-zA-Z0-9_.-]+$/)
    .messages({ 'string.pattern.base': 'Username may contain only letters, numbers, dots, dashes and underscores' })
    .optional(),
  fullName: Joi.string().trim().min(1).max(150).optional(),
  email: Joi.string().email().max(200).allow('').allow(null).optional(),
  phone: Joi.string().trim().max(30).allow('').allow(null).optional(),
  role: Joi.string().valid(...API_ASSIGNABLE_ROLES).optional(),
  isActive: Joi.boolean().optional(),
  password: Joi.string().min(8).max(128).optional(),
  // null/'' unlinks the partner identity; omitted leaves it unchanged.
  partnerPublicId: publicIdSchema.allow(null, '').optional(),
}).min(1);

export const setUserActiveSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(128).required(),
});
