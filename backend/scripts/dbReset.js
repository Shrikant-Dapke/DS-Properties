import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'ds_properties_v4',
});

const TABLES = [
  'schema_migrations',
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