import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import { env } from '../config/env.js';

async function seed() {
  const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const email = process.env.ADMIN_EMAIL || 'admin@dsproperties.local';
  const name = process.env.ADMIN_NAME || 'Administrator';

  await mongoose.connect(env.mongoUri);

  const existing = await Admin.findOne({ username });
  if (existing) {
    console.log(`Admin "${username}" already exists. Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.create({
    username,
    email,
    passwordHash,
    name,
  });

  console.log(`Admin "${admin.username}" created successfully.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
