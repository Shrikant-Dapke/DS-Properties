# NEXT_TASK

_Updated: 20 Aug 2026_

## Status: Ready to ship

All spec-scoped features are built, tested, and verified end-to-end. An audit +
corrective pass, a customer/partner selector fix, and a session-stability fix
("Save Entry → redirected to Login" — transient refresh failures no longer
destroy the session; refresh is single-flight; session restore is offline while
the access token is valid) are complete with regression coverage.

## Do next (in order)

1. **Final verification pass** — `npm run lint` + `npm test` (backend), `npm run lint` +
   `npm test` + `npm run build` (frontend). Then commit pending changes.
2. **Change default admin password** after first login (currently `Admin@123`).
3. **Production deployment** — Dockerfile + compose profile for both services, CI, and a
   managed Postgres; secure env handling. Requires Docker or a cloud DB.

## Follow-up backlog (deferred by design)

- **Change-password UX** — endpoint + modal exist (sidebar footer). Consider a forced
  password change on first login for non-seed users.
- **Frontend test coverage** — Vitest + RTL suite exists (AddEntry regression +
  auth-client integration tests); extend to transactions list and reports.
- **Auth rate limits** — currently 20 auth requests / 15 min shared by login +
  refresh. Traffic is now minimal (offline restore, single-flight refresh); revisit
  the number if multi-tab usage grows.
- **Backup strategy** — document `pg_dump` schedule and add a `npm run backup` script.
- **PWA / offline** — optional; not in spec scope.