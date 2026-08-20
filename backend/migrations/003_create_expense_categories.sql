-- 003: expense_categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id   uuid NOT NULL DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX uq_expense_categories_public_id ON expense_categories (public_id);
CREATE UNIQUE INDEX uq_expense_categories_slug ON expense_categories (slug) WHERE deleted_at IS NULL;
CREATE INDEX ix_expense_categories_active ON expense_categories (is_active) WHERE deleted_at IS NULL;