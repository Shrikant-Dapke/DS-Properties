import dotenv from 'dotenv';
import { createScriptPool } from './dbPool.js';

dotenv.config();

// Safety guard: dropping all tables must never happen in production.
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing: `npm run db:reset` is blocked in NODE_ENV=production.');
  process.exit(1);
}

const pool = createScriptPool();

const TABLES = [
  'schema_migrations',
  'change_approvals',
  'change_requests',
  'refresh_tokens',
  'audit_logs',
  'transactions',
  'app_settings',
  'partners',
  'expense_categories',
  'customers',
  'users',
];

async function reset() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of TABLES) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    await client.query('COMMIT');
    console.log(`Dropped ${TABLES.length} tables. Run "npm run migrate && npm run seed" to rebuild.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

reset();