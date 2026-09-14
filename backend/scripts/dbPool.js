// Shared PostgreSQL pool factory for owner-run scripts (migrate, seed,
// provision-developer, db:reset). Prefers DATABASE_URL (Supabase, incl. the
// pooled 6543 endpoint) with mandatory SSL, and falls back to the individual
// PG* fields for local development. Reads process.env directly so scripts
// stay independent of the app config validator.
import pg from 'pg';

const { Pool } = pg;

export function createScriptPool() {
  if (process.env.DATABASE_URL) {
    const sslDisabled = String(process.env.PGSSL || '').toLowerCase() === 'false';
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslDisabled ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX || 5),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }
  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'ds_properties_v4',
  });
}
