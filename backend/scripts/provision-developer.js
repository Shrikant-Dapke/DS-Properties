// Owner-only developer provisioning for EXISTING databases.
//
// Usage (owner shell access required):
//   DEVELOPER_USERNAME=owner DEVELOPER_PASSWORD='<strong-secret>' npm run provision-developer
//   DEVELOPER_USERNAME=owner DEVELOPER_PASSWORD='<new-secret>' npm run provision-developer -- --reset
//
// - Without --reset: creates the developer account only if none exists.
// - With --reset: rotates the password of the existing developer account
//   (and reactivates it). Refuses to create a second developer account.
// - Never touches non-developer accounts. Fails loudly on misuse.
//
// This script plus `seeds/004_seed_developer_user.js` are the ONLY supported
// paths to a developer account. The application API rejects the developer
// role for every caller, including admins.
import bcrypt from 'bcrypt';
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

const USERNAME = process.env.DEVELOPER_USERNAME;
const PASSWORD = process.env.DEVELOPER_PASSWORD;
const RESET = process.argv.includes('--reset');

async function run() {
  if (!USERNAME || !PASSWORD) {
    console.error('Refusing: set DEVELOPER_USERNAME and DEVELOPER_PASSWORD in the environment.');
    process.exitCode = 1;
    await pool.end();
    return;
  }
  if (PASSWORD.length < 12) {
    console.error('Refusing: developer password must be at least 12 characters.');
    process.exitCode = 1;
    await pool.end();
    return;
  }
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, username, is_active FROM users WHERE role = 'developer' AND deleted_at IS NULL`,
    );
    if (existing.rows.length > 0) {
      const dev = existing.rows[0];
      if (!RESET) {
        console.error(`Refusing: developer account '${dev.username}' already exists. Re-run with --reset to rotate its password.`);
        process.exitCode = 1;
        return;
      }
      if (dev.username !== USERNAME) {
        console.error(`Refusing: --reset targets the existing developer '${dev.username}', not '${USERNAME}'.`);
        process.exitCode = 1;
        return;
      }
      const passwordHash = await bcrypt.hash(PASSWORD, 12);
      await client.query(
        `UPDATE users SET password_hash = $1, is_active = true, failed_login_attempts = 0, locked_until = NULL
         WHERE id = $2`,
        [passwordHash, dev.id],
      );
      await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [dev.id]);
      console.log(`Developer password rotated for '${USERNAME}'. All sessions revoked.`);
      return;
    }
    if (RESET) {
      console.error('Refusing: no developer account exists yet; run without --reset to create it.');
      process.exitCode = 1;
      return;
    }
    const nameTaken = await client.query('SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL', [USERNAME]);
    if (nameTaken.rows.length > 0) {
      console.error(`Refusing: username '${USERNAME}' is already taken.`);
      process.exitCode = 1;
      return;
    }
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await client.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, 'System Owner', 'developer')`,
      [USERNAME, passwordHash],
    );
    console.log(`Developer account '${USERNAME}' created. Store the password in the owner password manager.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
