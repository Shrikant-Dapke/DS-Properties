import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Partner from '../models/Partner.js';
import { env } from '../config/env.js';

/**
 * Links existing Partner business records to login Users (role 'partner') by
 * setting Partner.userId. Opt-in: only runs when CREATE_PARTNER_USERS=true and a
 * PARTNER_DEFAULT_PASSWORD is provided, so no login accounts are created by
 * accident. Idempotent: skips partners that already have a userId or already
 * have a user.
 *
 * Username is derived from the partner name; the generated password is logged
 * once for the operator to share securely. Change passwords after first login.
 */
function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'partner'
  );
}

async function seed() {
  if (process.env.CREATE_PARTNER_USERS !== 'true') {
    console.log(
      'CREATE_PARTNER_USERS is not "true". Skipping partner-user creation. ' +
        'Set CREATE_PARTNER_USERS=true and PARTNER_DEFAULT_PASSWORD to link partners to login users.'
    );
    return;
  }

  const password = process.env.PARTNER_DEFAULT_PASSWORD;
  if (!password) {
    console.error('PARTNER_DEFAULT_PASSWORD is required to create partner users.');
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);
  const passwordHash = await bcrypt.hash(password, 12);

  const partners = await Partner.find({ userId: null });
  let linked = 0;

  for (const partner of partners) {
    const base = slugify(partner.name);
    let username = base;
    let n = 1;
    while (await User.findOne({ username })) {
      n += 1;
      username = `${base}-${n}`;
    }

    const user = await User.create({
      username,
      email: partner.email || undefined,
      passwordHash,
      name: partner.name,
      role: 'partner',
      partnerId: partner._id,
      active: partner.status === 'Active',
    });

    partner.userId = user._id;
    await partner.save();

    console.log(`Linked partner "${partner.name}" -> user "${username}"`);
    linked += 1;
  }

  console.log(`Partner linking complete. linked=${linked}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Partner user seed failed:', err.message);
  process.exit(1);
});
