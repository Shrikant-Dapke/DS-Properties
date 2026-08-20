import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';
process.env.PGDATABASE = process.env.PGDATABASE || 'ds_properties_v4_test';
process.env.LOG_LEVEL = 'silent';

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'dsp_v4',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE,
});

async function resetAndMigrate() {
  const client = await pool.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');

    const migrationsDir = join(__dirname, '..', 'migrations');
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      await client.query(readFileSync(join(migrationsDir, file), 'utf8'));
    }

    const seedsDir = join(__dirname, '..', 'seeds');
    const seedFiles = readdirSync(seedsDir).filter((f) => f.endsWith('.js')).sort();
    for (const file of seedFiles) {
      const seed = await import(pathToFileURL(join(seedsDir, file)).href);
      await seed.run(client);
    }
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  await resetAndMigrate();
});

afterAll(async () => {
  await pool.end();
});

export { pool };