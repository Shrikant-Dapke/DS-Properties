-- 012: exactly three account types — developer, partner, admin.
-- READ_ONLY is retired as a production role (admin is the supervisory role;
-- partners operate business data under unanimous governance).
--
-- Data safety: no user row is deleted. Any surviving read_only account is
-- deactivated (fail closed, fully reversible by the owner: reactivate and
-- assign developer/partner/admin through the owner provisioning flow).
-- At the time of writing no read_only rows exist in any environment; this
-- UPDATE is a defensive guard for databases upgraded across versions.
UPDATE users SET is_active = false WHERE role = 'read_only';

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;

ALTER TABLE users
  ADD CONSTRAINT chk_users_role CHECK (role IN ('developer', 'partner', 'admin'));
