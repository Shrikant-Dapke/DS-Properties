-- 014: restore the canonical default application settings.
--
-- Mirrors seeds/003_seed_app_settings.js. Needed because the standard seed is
-- intentionally blocked in production, so fresh production databases would
-- otherwise render an empty Settings page and lack baseline configuration.
--
-- Safety properties (all preserved):
-- - Idempotent: ON CONFLICT (key) DO NOTHING, so re-applying never duplicates
--   or overwrites an owner-customized value.
-- - Existing values are never touched: inserts only, no UPDATE.
-- Values are stored as JSON, exactly as the seed writes them.
INSERT INTO app_settings (key, value, description)
VALUES
  ('company_name', '"DS Properties"', 'Business/company display name'),
  ('currency', '"INR"', 'Currency code used for financial display'),
  ('opening_balance', '"0"', 'Opening cash balance at system start'),
  ('financial_year_start_month', '"4"', 'Financial year start month (4 = April)')
ON CONFLICT (key) DO NOTHING;
