import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../setup.js';
import { getAdminToken, authHeader } from '../helpers/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function migrationSql(name) {
  return readFileSync(join(__dirname, '..', '..', 'migrations', name), 'utf8');
}

async function categoryCount() {
  const r = await pool.query('SELECT count(*)::int AS total FROM expense_categories WHERE deleted_at IS NULL');
  return r.rows[0].total;
}

async function settingCount() {
  const r = await pool.query('SELECT count(*)::int AS total FROM app_settings');
  return r.rows[0].total;
}

describe('Production default data restores (013 categories, 014 settings)', () => {
  let adminToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  it('013 is idempotent: re-applying never duplicates or removes categories', async () => {
    const before = await categoryCount();
    await pool.query(migrationSql('013_seed_default_categories.sql'));
    await pool.query(migrationSql('013_seed_default_categories.sql'));
    expect(await categoryCount()).toBe(before);
  });

  it('013 restores a missing canonical category while preserving custom ones', async () => {
    await pool.query(
      `INSERT INTO expense_categories (name, slug, description, sort_order)
       VALUES ('Custom Earthwork', 'custom-earthwork-test', 'owner custom', 50)
       ON CONFLICT DO NOTHING`,
    );
    await pool.query(`DELETE FROM expense_categories WHERE slug = 'legal'`);
    const before = await categoryCount();

    await pool.query(migrationSql('013_seed_default_categories.sql'));

    const rows = await pool.query('SELECT slug FROM expense_categories WHERE deleted_at IS NULL');
    const slugs = rows.rows.map((r) => r.slug);
    // Canonical set restored ...
    for (const slug of ['road-construction', 'gutter-work', 'electricity', 'water', 'labor', 'legal', 'other']) {
      expect(slugs).toContain(slug);
    }
    // ... custom row preserved, exactly one legal row, count grows by exactly one.
    expect(slugs).toContain('custom-earthwork-test');
    expect(slugs.filter((s) => s === 'legal')).toHaveLength(1);
    expect(await categoryCount()).toBe(before + 1);

    // The restored category is usable through the API.
    const res = await request(app)
      .get('/api/v1/categories/active')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.slug)).toContain('legal');
  });

  it('014 is idempotent and never overwrites an owner-customized value', async () => {
    const before = await settingCount();
    await pool.query(migrationSql('014_seed_default_settings.sql'));
    await pool.query(migrationSql('014_seed_default_settings.sql'));
    expect(await settingCount()).toBe(before);

    await pool.query(`UPDATE app_settings SET value = '"Custom Co"' WHERE key = 'company_name'`);
    await pool.query(`DELETE FROM app_settings WHERE key = 'currency'`);
    await pool.query(migrationSql('014_seed_default_settings.sql'));

    const rows = await pool.query('SELECT key, value FROM app_settings');
    const byKey = Object.fromEntries(rows.rows.map((r) => [r.key, r.value]));
    // Missing key restored, customized value untouched.
    expect(byKey.currency).toBe('INR');
    expect(byKey.company_name).toBe('Custom Co');
    expect(await settingCount()).toBe(before);

    // Settings API serves the restored rows.
    const res = await request(app).get('/api/v1/settings').set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.key)).toEqual(
      expect.arrayContaining(['company_name', 'currency', 'opening_balance', 'financial_year_start_month']),
    );
  });
});
