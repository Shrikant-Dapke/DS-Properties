import app from './src/app.js';
import { config } from './src/config/environment.js';
import { checkDatabase } from './src/config/database.js';
import { logger } from './src/utils/logger.js';

async function start() {
  try {
    await checkDatabase();
    logger.info('Database connection verified');
  } catch (err) {
    logger.error({ err }, 'Database connection failed');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    logger.info(`DS Properties V4 API listening on port ${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();