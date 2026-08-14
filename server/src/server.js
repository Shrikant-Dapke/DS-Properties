import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

async function start() {
  const app = createApp();

  await connectDB(env.mongoUri);
  console.log(`MongoDB connected (${env.mongoUri})`);

  app.listen(env.port, () => {
    console.log(`DS Properties server running on port ${env.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
