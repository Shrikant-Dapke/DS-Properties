-- 007: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint REFERENCES users (id) ON DELETE SET NULL,
  action      text NOT NULL,
  domain      text NOT NULL,
  record_id   text,
  old_values  jsonb,
  new_values  jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_audit_logs_domain_action ON audit_logs (domain, action);
CREATE INDEX ix_audit_logs_user ON audit_logs (user_id);
CREATE INDEX ix_audit_logs_created ON audit_logs (created_at);
CREATE INDEX ix_audit_logs_record ON audit_logs (domain, record_id);