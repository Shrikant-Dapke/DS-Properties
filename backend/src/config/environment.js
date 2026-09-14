import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().default(3000),
  API_PREFIX: Joi.string().default('/api/v1'),
  // Supabase / pooled connections: prefer a single connection string in
  // production (Vercel serverless). When DATABASE_URL is set, the
  // individual PG* fields are optional and ignored for connection purposes.
  DATABASE_URL: Joi.string().allow('').optional(),
  PGHOST: Joi.string().allow('').optional(),
  PGPORT: Joi.number().integer().optional(),
  PGUSER: Joi.string().allow('').optional(),
  PGPASSWORD: Joi.string().allow('').optional(),
  PGDATABASE: Joi.string().allow('').optional(),
  // PGPOOL_MAX caps concurrent connections. Serverless functions must stay
  // small (Supabase pooled tier); defaults to 5 in production, 20 otherwise.
  PGPOOL_MAX: Joi.number().integer().min(1).max(50).optional(),
  // SSL: Supabase requires it. Defaults ON when DATABASE_URL is set unless
  // explicitly disabled with PGSSL=false.
  PGSSL: Joi.boolean().optional(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  TRUST_PROXY: Joi.boolean().default(false),
}).unknown();

const { value: env, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  throw new Error(`Invalid environment configuration:\n${error.details.map((d) => `  - ${d.message}`).join('\n')}`);
}

// Host/port/user/database are only required for direct (non-URL) connections.
// When DATABASE_URL is present (Supabase on Vercel), they may be absent.
if (!env.DATABASE_URL && (!env.PGUSER || !env.PGDATABASE)) {
  throw new Error(
    'Invalid environment configuration:\n  - Either DATABASE_URL or PGUSER + PGDATABASE must be set',
  );
}

const isProd = env.NODE_ENV === 'production';
const useSsl = env.PGSSL === true || (Boolean(env.DATABASE_URL) && env.PGSSL !== false);

export const config = {
  nodeEnv: env.NODE_ENV,
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  db: {
    connectionString: env.DATABASE_URL || null,
    host: env.PGHOST || 'localhost',
    port: env.PGPORT || 5432,
    user: env.PGUSER || null,
    password: env.PGPASSWORD || '',
    database: env.PGDATABASE || null,
    ssl: useSsl,
    poolMax: env.PGPOOL_MAX || (isProd ? 5 : 20),
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