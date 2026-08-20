import bcrypt from 'bcrypt';

const ADMIN = {
  username: 'admin',
  fullName: 'System Administrator',
  email: 'admin@dsproperties.local',
  role: 'admin',
  // Default credentials — CHANGE immediately after first login.
  password: 'Admin@123',
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