import bcrypt from 'bcrypt';

// Owner-only developer account seed.
//
// The developer is the single owner/maintenance identity with full system
// access. It is NEVER creatable through the application API (validators and
// services reject the developer role for every caller, including admins).
//
// Provisioning requires host access plus environment secrets, which is what
// makes it owner-only:
//   SEED_DEVELOPER_USERNAME (default: 'owner')
//   SEED_DEVELOPER_PASSWORD (REQUIRED in production — no dev fallback)
// The seed is idempotent: if a developer account already exists, it does
// nothing and never rotates or overwrites credentials.
//
// MANUAL ROTATION: use `npm run provision-developer` (owner shell access) or
// log in as the developer and use change-password.
const USERNAME = process.env.SEED_DEVELOPER_USERNAME || 'owner';
const PASSWORD = process.env.SEED_DEVELOPER_PASSWORD;

export async function run(client) {
  const existing = await client.query(
    `SELECT id FROM users WHERE role = 'developer' AND deleted_at IS NULL LIMIT 1`,
  );
  if (existing.rows.length > 0) {
    console.log('  developer user already exists, skipping');
    return;
  }
  if (!PASSWORD) {
    console.log('  SEED_DEVELOPER_PASSWORD not set, skipping developer seed (set it to provision the owner account)');
    return;
  }
  const nameTaken = await client.query('SELECT id FROM users WHERE username = $1', [USERNAME]);
  if (nameTaken.rows.length > 0) {
    throw new Error(`seed username '${USERNAME}' is already taken by a non-developer account`);
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await client.query(
    `INSERT INTO users (username, password_hash, full_name, email, role)
     VALUES ($1, $2, $3, $4, 'developer')`,
    [USERNAME, passwordHash, 'System Owner', null],
  );
  console.log('  created developer user');
}
