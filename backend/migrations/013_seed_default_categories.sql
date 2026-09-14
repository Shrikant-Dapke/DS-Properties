-- 013: restore the canonical default expense categories.
--
-- Mirrors seeds/001_seed_categories.js (the long-standing canonical set).
-- Needed because the standard seed is intentionally blocked in production,
-- so fresh production databases would otherwise start with zero categories.
--
-- Safety properties (all preserved):
-- - Idempotent: bare ON CONFLICT DO NOTHING, so re-applying this file (or a
--   deploy that re-runs migrate) never creates duplicates.
-- - Custom categories are never touched: no DELETE/UPDATE, inserts only.
-- - Existing ids and transaction references are unaffected: conflicting rows
--   are skipped, never replaced.
INSERT INTO expense_categories (name, slug, description, sort_order)
VALUES
  ('Road Construction', 'road-construction', 'Road and approach construction expenses', 1),
  ('Gutter Work', 'gutter-work', 'Gutter and drainage work expenses', 2),
  ('Electricity', 'electricity', 'Electricity and electrification expenses', 3),
  ('Water', 'water', 'Water supply and borewell expenses', 4),
  ('Labor', 'labor', 'Labor charges for site work', 5),
  ('Legal', 'legal', 'Legal, documentation and registration expenses', 6),
  ('Other', 'other', 'Any other business expense', 99)
ON CONFLICT DO NOTHING;
