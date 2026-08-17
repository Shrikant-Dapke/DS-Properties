import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { env } from '../config/env.js';

/**
 * Seeds the initial Developer account (V2 system owner).
 * Safe to re-run: skips if a developer with the same username already exists.
 * Credentials come from environment variables — never hardcoded.
 */
async function seed() {
  const username = (process.env.DEV_USERNAME || 'developer').toLowerCase();
  const password = process.env.DEV_PASSWORD;
  const email = process.env.DEV_EMAIL || `${username}@dsproperties.local`;
  const name = process.env.DEV_NAME || 'Developer';

  if (!password) {
    console.error(
      'DEV_PASSWORD is not set. Refusing to create a developer with an empty password.'
    );
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);

  const existing = await User.findOne({ username, role: 'developer' });
  if (existing) {
    console.log(`Developer "${username}" already exists. Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const developer = await User.create({
    username,
    email,
    passwordHash,
    name,
    role: 'developer',
    active: true,
  });

  console.log(`Developer "${developer.username}" created successfully.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Developer seed failed:', err.message);
  process.exit(1);
});
