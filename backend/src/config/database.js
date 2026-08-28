import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './environment.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// Active-transaction store. When a `withTransaction` block runs, every call to
// `query` (including those made deep inside models/services) participates in the
// same PostgreSQL transaction by using the stored client. This lets the approval
// applier run entity writes + audit inserts atomically without threading a
// `client` argument through every function signature.
const txStore = new AsyncLocalStorage();

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

export async function checkDatabase() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}

export function query(text, params) {
  const client = txStore.getStore();
  return (client || pool).query(text, params);
}

/**
 * Run `callback` inside a PostgreSQL transaction. The client is made available
 * to every `query()` call within the async context, so nested model/service
 * writes are committed or rolled back together. If `callback` throws, the
 * transaction is rolled back and the error rethrown.
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await txStore.run(client, callback);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}