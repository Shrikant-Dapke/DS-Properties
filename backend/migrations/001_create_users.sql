-- 001: users
CREATE TABLE IF NOT EXISTS users (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  username              text NOT NULL,
  password_hash         text NOT NULL,
  full_name             text NOT NULL,
  email                 text,
  phone                 text,
  role                  text NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  is_active             boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE UNIQUE INDEX uq_users_username ON users (username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_public_id ON users (public_id);
CREATE INDEX ix_users_role ON users (role) WHERE deleted_at IS NULL;