-- 011: partner application role + user-to-partner identity link.
-- Additive and non-destructive: no existing rows are modified. Existing
-- users keep their roles; the new `partner` role is opt-in for new/linked users.

-- 1. Identity link: a login user may act as exactly one business partner.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS partner_id bigint REFERENCES partners (id) ON DELETE SET NULL;

-- 2. Extend the role model with the partner operator role.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;

ALTER TABLE users
  ADD CONSTRAINT chk_users_role CHECK (role IN ('admin', 'read_only', 'partner'));

-- 3. One active login identity per business partner: prevents two users from
-- claiming (or being granted) the same partner identity, which would break
-- requester/approver attribution in partner governance.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_partner
  ON users (partner_id) WHERE partner_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_users_partner ON users (partner_id);
