import bcrypt from 'bcrypt';

// Initial admin user seed.
//
// The password comes from SEED_ADMIN_PASSWORD so production can inject a
// unique secret via the environment. The fallback below is a LOCAL DEV/TEST
// default only — it must never be used in production.
//
// MANUAL ROTATION (no automatic rotation is performed):
//   1. Prefer setting SEED_ADMIN_PASSWORD to a strong random value BEFORE the
//      first `npm run seed` on any real environment.
//   2. After first login, change the password via POST /api/v1/auth/change-password
//      (or an admin can use the users reset-password flow).
const ADMIN = {
  username: 'admin',
  fullName: 'System Administrator',
  email: 'admin@dsproperties.local',
  role: 'admin',
  // Dev/test fallback only — override with SEED_ADMIN_PASSWORD everywhere else.
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
};

export async function run(client) {
  const { rows } = await client.query('SELECT id FROM users WHERE username = $1', [ADMIN.username]);
  if (rows.length > 0) {
    console.log('  admin user already exists, skipping');
    return;
  }
  const passwordHash = await bcrypt.hash(ADMIN.password, 12);
  await client.query(
    `INSERT INTO users (username, password_hash, full_name, email, role)
     VALUES ($1, $2, $3, $4, $5)`,
    [ADMIN.username, passwordHash, ADMIN.fullName, ADMIN.email, ADMIN.role],
  );
  console.log('  created admin user');
}