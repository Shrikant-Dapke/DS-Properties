import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { createScriptPool } from './dbPool.js';

dotenv.config();

// Safety guard: the standard seed inserts demo business data (categories,
// an admin login, default settings) and must NEVER run against the fresh
// production database, which holds only the owner/developer account.
// Provision production with `npm run migrate` + `npm run provision-developer`
// instead. Override only deliberately: ALLOW_SEED_IN_PRODUCTION=true.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
  console.error(
    'Refusing: `npm run seed` inserts demo data and is blocked in NODE_ENV=production.\n' +
      'For a fresh production database, run only `npm run migrate` then `npm run provision-developer`.\n' +
      'To override deliberately, set ALLOW_SEED_IN_PRODUCTION=true.',
  );
  process.exit(1);
}

const pool = createScriptPool();

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedsDir = join(__dirname, '..', 'seeds');

async function run() {
  const files = readdirSync(seedsDir).filter((f) => f.endsWith('.js')).sort();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      const seed = await import(pathToFileURL(join(seedsDir, file)).href);
      console.log(`seeding ${file}`);
      await seed.run(client);
    }
    await client.query('COMMIT');
    console.log('\nSeed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();