# PROJECT_STATUS

_Updated: 20 Aug 2026_

## Summary

DS Properties V4 is **feature-complete** for the scope defined in the master onboarding
spec, and has passed an audit + corrective pass, a session-stability fix
("Save Entry → redirected to Login"), and a date-range filtering feature (Daily /
Weekly / Monthly / Yearly / Custom quick modes across Dashboard, Transactions, and
Reports), each with regression coverage; the full suite is green.

## Completed

| Area | Status |
|---|---|
| Database schema (9 migrations, triggers, CHECK constraints, partial indexes) | ✅ |
| Seeds (7 expense categories, admin user, app settings) | ✅ |
| Backend API (auth, customers, partners, categories, transactions, dashboard, reports, settings, users, audit) | ✅ |
| Auth security (bcrypt, JWT 15 min, rotating refresh tokens, lockout, rate limits) | ✅ |
| Financial integrity (reversals, soft deletes, duplicate warnings, exact numeric(14,2)) | ✅ |
| Transaction editing (`PATCH /transactions/:id`, admin + operator, audit-logged) | ✅ |
| Audit trail on all meaningful actions | ✅ |
| Automated tests (51 backend integration tests, 15 frontend tests [9 component + 6 auth-client integration], all passing) | ✅ |
| Frontend (login, dashboard w/ charts, add/edit entry, transactions, customers, partners, categories, reports, settings, users, audit, change password) | ✅ |
| Report exports (PDF + Excel buttons on every report tab) | ✅ |
| Date-range filtering (Daily / Weekly / Monthly / Yearly / Custom) across Dashboard, Transactions, Reports | ✅ |
| Responsive layout (desktop sidebar + mobile bottom nav) | ✅ |
| End-to-end verification (live API + Vite proxy) | ✅ |

## Verified (this session)

- `backend`: 65/65 Jest tests pass; ESLint clean.
- `frontend`: `vite build` succeeds; ESLint clean; 44/44 Vitest tests pass —
  9 AddEntry component tests, 6 live-backend auth-client integration tests
  (expired-token auto-refresh + retry, single-flight concurrent restore,
  offline restore with valid token, revoked-token logout, transient-429 session
  preservation), 22 `dateRange` utility tests, 7 `DateRangeFilter` component tests.
- Date-range feature (live API against the dev DB with seeded fixture data): FY,
  monthly, weekly, daily, and custom ranges return correct intake/outtake/net/opening
  numbers; transactions list, category breakdown, and partner report all honor the
  range; dashboard cache keys are range-scoped and invalidated on create/update/reverse.
- Date-range feature (live browser): login → dashboard renders with the FY default
  (`2026-04-01` – `2027-03-31`); switching to Monthly / Weekly / Custom issues backend
  requests with the exact expected `from`/`to`; Transactions auto-applies the selected
  range and resets pagination; Reports monthly/categories/partner tabs each send their
  default or custom range; exports use the same ranged data.
- Session-stability regression (live): expired access token at save time →
  single refresh → original request retried → 201 → navigated; two reloads stay
  authenticated; with the auth rate limit exhausted, refresh 429 keeps the
  session (no redirect, no token wipe) and the login page shows the accurate
  "Too many requests" alert.
- Live end-to-end: login → create customer/partner/category → create intake, partner
  capital, outtake → list/filter transactions → edit an entry → dashboard balance
  correct → reversal updates balance → monthly report → category report → customer
  ledger → users list → audit log. Vite dev server proxies `/api` to the backend
  correctly.

## Known gaps

- **Production deploy** — no Docker image / CI / hosting config yet (Docker is not
  installed on this machine; `docker-compose.yml` is provided for portability).
- **Backup strategy** — documented procedure only; no scheduled backup script.
- **Frontend coverage** — component coverage is growing (AddEntry, auth-client
  integration, dateRange utilities, DateRangeFilter suites); the backend suite still
  carries most of the functional contract.

## Running it

```powershell
cd backend && npm run dev       # :3000
cd frontend && npm run dev      # :5173
```

Login: `admin` / `Admin@123` (change after first login).
