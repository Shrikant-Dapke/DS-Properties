import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { seedCategories } from '../services/category.service.js';

async function run() {
  await mongoose.connect(env.mongoUri);
  const created = await seedCategories();
  if (created === 0) {
    console.log('Categories already seeded. Nothing to do.');
  } else {
    console.log(`Seeded ${created} category(ies).`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Category seed failed:', err.message);
  process.exit(1);
});
