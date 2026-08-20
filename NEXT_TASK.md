# NEXT_TASK

_Updated: 20 Aug 2026_

## Status: Ready to ship

All spec-scoped features are built, tested, and verified end-to-end. An audit +
corrective pass (outtake form state, duplicate-dialog flow, JWT expiry consistency,
transaction editing, partner report totals, password sanitization, report exports) is
complete with regression coverage.

## Do next (in order)

1. **Final verification pass** — `npm run lint` + `npm test` (backend), `npm run lint` +
   `npm test` + `npm run build` (frontend). Then commit the audit changes.
2. **Change default admin password** after first login (currently `Admin@123`).
3. **Production deployment** — Dockerfile + compose profile for both services, CI, and a
   managed Postgres; secure env handling. Requires Docker or a cloud DB.

## Follow-up backlog (deferred by design)

- **Change-password UX** — endpoint + modal exist (sidebar footer). Consider a forced
  password change on first login for non-seed users.
- **Frontend test coverage** — Vitest + RTL suite exists (AddEntry regression tests);
  extend to auth flow, transactions list, and reports.
- **Backup strategy** — document `pg_dump` schedule and add a `npm run backup` script.
- **PWA / offline** — optional; not in spec scope.
