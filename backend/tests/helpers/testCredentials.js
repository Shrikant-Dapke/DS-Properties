// Test-only admin credentials for the Jest integration suite.
//
// Both values may be overridden via the environment, but the fallbacks mirror
// the seed's LOCAL DEV default (see backend/seeds/002_seed_admin_user.js), so
// the suite passes against a normally-seeded test database with no extra setup.
// NEVER use these values in production.
export const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || 'admin';
export const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Admin@123';
