import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().default(3000),
  API_PREFIX: Joi.string().default('/api/v1'),
  PGHOST: Joi.string().default('localhost'),
  PGPORT: Joi.number().integer().default(5432),
  PGUSER: Joi.string().required(),
  PGPASSWORD: Joi.string().allow('').required(),
  PGDATABASE: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('30m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  TRUST_PROXY: Joi.boolean().default(false),
}).unknown();

const { value: env, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  throw new Error(`Invalid environment configuration:\n${error.details.map((d) => `  - ${d.message}`).join('\n')}`);
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  db: {
    host: env.PGHOST,
    port: env.PGPORT,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpires: env.JWT_ACCESS_EXPIRES,
    refreshExpires: env.JWT_REFRESH_EXPIRES,
  },
  corsOrigin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
  trustProxy: env.TRUST_PROXY,
};