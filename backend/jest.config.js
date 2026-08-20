import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';
process.env.PGDATABASE = process.env.PGDATABASE || 'ds_properties_v4_test';
process.env.LOG_LEVEL = 'silent';

export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  verbose: true,
  testTimeout: 30000,
  maxWorkers: 1,
};