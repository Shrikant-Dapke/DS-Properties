import { pino } from 'pino';
import { config } from '../config/environment.js';

export const logger = pino({
  level: config.isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.oldPassword',
      '*.newPassword',
    ],
    censor: '[REDACTED]',
  },
  base: { env: config.nodeEnv },
});