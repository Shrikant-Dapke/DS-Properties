# NEXT_TASK

_Updated: 20 Aug 2026_

## Status: Ready to ship

All spec-scoped features are built, tested, and verified end-to-end. An audit +
corrective pass, a customer/partner selector fix, a session-stability fix
("Save Entry → redirected to Login" — transient refresh failures no longer
destroy the session; refresh is single-flight; session restore is offline while
the access token is valid), and the date-range filtering feature (Daily / Weekly /
Monthly / Yearly / Custom quick modes across Dashboard, Transactions, and Reports)
are complete with regression coverage.

## Do next (in order)

1. **Final verification pass** — `npm run lint` + `npm test` (backend), `npm run lint` +
   `npm test` + `npm run build` (frontend). Then commit pending changes.
2. **Change default admin password** after first login (currently `Admin@123`).
3. **Production deployment** — Dockerfile + compose profile for both services, CI, and a
   managed Postgres; secure env handling. Requires Docker or a cloud DB.

## Follow-up backlog (deferred by design)

- **URL/query-state persistence for ranges** — the date-range feature intentionally does
  not persist the selected range in the URL; consider adding it if shareable report URLs
  become desirable.
- **Change-password UX** — endpoint + modal exist (sidebar footer). Consider a forced
  password change on first login for non-seed users.
- **Frontend test coverage** — Vitest + RTL suite exists (AddEntry regression,
  auth-client integration, dateRange utilities, DateRangeFilter); extend to the
  transactions list and report tab interactions.
- **Auth rate limits** — currently 20 auth requests / 15 min shared by login +
  refresh. Traffic is now minimal (offline restore, single-flight refresh); revisit
  the number if multi-tab usage grows.
- **Backup strategy** — document `pg_dump` schedule and add a `npm run backup` script.
- **PWA / offline** — optional; not in spec scope.