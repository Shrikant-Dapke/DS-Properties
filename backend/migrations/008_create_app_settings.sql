-- 008: app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key          text NOT NULL,
  value        jsonb NOT NULL,
  description  text,
  updated_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_app_settings_key ON app_settings (key);