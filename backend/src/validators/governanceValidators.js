import Joi from 'joi';
import { GOVERNANCE_ENTITY_TYPES, GOVERNANCE_OPERATIONS } from '../config/constants.js';
import { ValidationError } from '../utils/errors.js';

import {
  createTransactionSchema,
  updateTransactionSchema,
} from './transactionValidators.js';
import { createCustomerSchema, updateCustomerSchema } from './customerValidators.js';
import { createPartnerSchema, updatePartnerSchema } from './partnerValidators.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from './categoryValidators.js';
import { createUserSchema, updateUserSchema } from './authValidators.js';
import { updateSettingSchema } from './reportValidators.js';

const reasonSchema = Joi.object({
  reason: Joi.string().trim().max(1000).allow('').allow(null).optional(),
}).unknown(true);

const emptySchema = Joi.object({}).unknown(true);

// Map of allowed (entityType, operation) -> Joi schema used to validate the
// proposed change payload server-side (defense in depth; routes also validate).
const PROPOSED_STATE_SCHEMAS = {
  transaction: {
    create: createTransactionSchema,
    update: updateTransactionSchema,
    delete: reasonSchema,
    reverse: reasonSchema,
  },
  customer: {
    create: createCustomerSchema,
    update: updateCustomerSchema,
    delete: emptySchema,
  },
  partner: {
    create: createPartnerSchema,
    update: updatePartnerSchema,
    delete: emptySchema,
  },
  category: {
    create: createCategorySchema,
    update: updateCategorySchema,
    delete: emptySchema,
  },
  user: {
    create: createUserSchema,
    update: updateUserSchema,
    delete: emptySchema,
  },
  app_setting: {
    update: updateSettingSchema,
  },
};

export function validateProposedState(entityType, operation, data) {
  if (!GOVERNANCE_ENTITY_TYPES.includes(entityType)) {
    throw new ValidationError('Unsupported governed entity type', [
      { field: 'entityType', message: `Unsupported entity type: ${entityType}` },
    ]);
  }
  if (!GOVERNANCE_OPERATIONS.includes(operation)) {
    throw new ValidationError('Unsupported governed operation', [
      { field: 'operation', message: `Unsupported operation: ${operation}` },
    ]);
  }
  const schema = PROPOSED_STATE_SCHEMAS[entityType]?.[operation];
  if (!schema) {
    throw new ValidationError('This entity/operation combination is not governed', [
      { field: 'operation', message: `${entityType}.${operation} is not governed` },
    ]);
  }
  const { error } = schema.validate(data, { abortEarly: false, convert: true });
  if (error) {
    throw new ValidationError('Proposed change failed validation', error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    })));
  }
  return data;
}

const decisionSchema = Joi.object({
  comment: Joi.string().trim().max(1000).allow('').allow(null).optional(),
});

export const decisionBodySchema = decisionSchema;

export function validateDecision(body) {
  const { value, error } = decisionSchema.validate(body, { abortEarly: false, convert: true });
  if (error) {
    throw new ValidationError('Validation failed', error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    })));
  }
  return value;
}
