import mongoose from 'mongoose';
import User from '../models/User.js';
import { env } from '../config/env.js';

/**
 * Migrates existing V1 Admin authentication records into the unified V2 User
 * collection with role 'admin'. Preserves identity (username/email/name) and the
 * existing passwordHash (no password conversion). Idempotent: skips admins that
 * already have a matching User. The original `admins` collection is left intact.
 */
async function migrate() {
  await mongoose.connect(env.mongoUri);

  const admins = await mongoose.connection
    .collection('admins')
    .find({})
    .toArray();

  let migrated = 0;
  let skipped = 0;

  for (const admin of admins) {
    const username = (admin.username || '').toLowerCase();
    if (!username) {
      skipped += 1;
      continue;
    }

    const existing = await User.findOne({ username });
    if (existing) {
      skipped += 1;
      continue;
    }

    await User.create({
      username,
      email: admin.email || undefined,
      passwordHash: admin.passwordHash,
      name: admin.name || undefined,
      role: 'admin',
      active: admin.active !== false,
      lastLoginAt: admin.lastLoginAt || null,
    });
    migrated += 1;
  }

  console.log(`Admin -> User migration complete. migrated=${migrated} skipped=${skipped}`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Admin migration failed:', err.message);
  process.exit(1);
});
