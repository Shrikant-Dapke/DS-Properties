-- 006: refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash      text NOT NULL,
  family_id       uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at      timestamptz NOT NULL,
  replaced_by_id  bigint REFERENCES refresh_tokens (id) ON DELETE SET NULL,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  ip_address      inet,
  user_agent      text
);

CREATE UNIQUE INDEX uq_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX ix_refresh_tokens_expires ON refresh_tokens (expires_at);