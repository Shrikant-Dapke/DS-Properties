-- 010: role model migration + approval governance domain
-- Non-destructive: existing rows are migrated, new tables are additive.

-- 1. Migrate the role model from (admin, operator, viewer) to (admin, read_only).
--    Drop the old CHECK, normalise existing rows first (so the new CHECK validates),
--    then add the new constraint.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Existing operator/viewer users lose direct write access and become read_only.
UPDATE users SET role = 'read_only' WHERE role IN ('operator', 'viewer');

ALTER TABLE users
  ADD CONSTRAINT chk_users_role CHECK (role IN ('admin', 'read_only'));

-- 2. Change requests: a governed mutation awaiting multi-admin approval.
CREATE TABLE IF NOT EXISTS change_requests (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type       text NOT NULL
                      CHECK (entity_type IN ('transaction','customer','partner','category','user','app_setting')),
  entity_id         text,
  operation         text NOT NULL
                      CHECK (operation IN ('create','update','delete','reverse')),
  requested_by      bigint REFERENCES users (id) ON DELETE SET NULL,
  previous_state    jsonb,
  proposed_state    jsonb NOT NULL,
  status            text NOT NULL
                      CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  required_approvers jsonb NOT NULL,
  version_tag       text,
  resolution_reason text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz
);

CREATE UNIQUE INDEX uq_change_requests_public_id ON change_requests (public_id);
CREATE INDEX ix_change_requests_status ON change_requests (status);
CREATE INDEX ix_change_requests_entity ON change_requests (entity_type, entity_id);
CREATE INDEX ix_change_requests_requested ON change_requests (requested_by);

-- 3. Per-admin approvals for a change request.
CREATE TABLE IF NOT EXISTS change_approvals (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  change_request_id bigint NOT NULL REFERENCES change_requests (id) ON DELETE CASCADE,
  admin_user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status           text NOT NULL CHECK (status IN ('APPROVED','REJECTED')),
  comment          text,
  decided_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- One decision per admin per request. Prevents duplicate approvals at the
  -- database level even if the application layer is bypassed.
  CONSTRAINT uq_change_approvals_request_admin
    UNIQUE (change_request_id, admin_user_id)
);

CREATE INDEX ix_change_approvals_request ON change_approvals (change_request_id);
CREATE INDEX ix_change_approvals_admin ON change_approvals (admin_user_id);

-- 4. Keep updated_at current on the new tables.
DROP TRIGGER IF EXISTS trg_change_requests_updated_at ON change_requests;
CREATE TRIGGER trg_change_requests_updated_at BEFORE UPDATE ON change_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_change_approvals_updated_at ON change_approvals;
CREATE TRIGGER trg_change_approvals_updated_at BEFORE UPDATE ON change_approvals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
