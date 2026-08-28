import Joi from 'joi';
import { ROLE_LIST } from '../config/constants.js';

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
  role: Joi.string().valid(...ROLE_LIST).required(),
});

export const updateUserSchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(150).optional(),
  email: Joi.string().email().max(200).allow('').allow(null).optional(),
  phone: Joi.string().trim().max(30).allow('').allow(null).optional(),
  role: Joi.string().valid(...ROLE_LIST).optional(),
  isActive: Joi.boolean().optional(),
  password: Joi.string().min(8).max(128).optional(),
}).min(1);

export const setUserActiveSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(128).required(),
});