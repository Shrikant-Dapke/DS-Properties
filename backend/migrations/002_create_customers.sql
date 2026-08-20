-- 002: customers
CREATE TABLE IF NOT EXISTS customers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id   uuid NOT NULL DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  phone       text,
  email       text,
  address     text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX uq_customers_public_id ON customers (public_id);
CREATE INDEX ix_customers_name ON customers (name) WHERE deleted_at IS NULL;
CREATE INDEX ix_customers_phone ON customers (phone) WHERE deleted_at IS NULL;