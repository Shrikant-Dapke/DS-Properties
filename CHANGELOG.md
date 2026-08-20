# CHANGELOG

All notable changes to DS Properties V4.

## [0.1.1] — 2026-08-20

Audit + corrective pass — confirmed findings fixed with regression coverage.

### Added

**Backend**
- `PATCH /transactions/:id` — edit an existing entry (admin + operator). Partial updates,
  classification preserved when not resent, rejects reversed/reversal records, writes an
  audit log, invalidates dashboard cache. Schema: `updateTransactionSchema`; model:
  `updateTransaction`.
- `partnerInflowTotals(partnerId)` SQL aggregate — partner financial report totals now
  span the full ledger, not just the current page.

**Frontend**
- Edit Entry mode (`/entries/new?edit=<publicId>`) with prefilled form and "Update entry"
  submit; Edit button on transaction rows for admin/operator (hidden for reversed/
  reversal rows).
- Export buttons (PDF + Excel) wired into every report tab (monthly, daily, category
  range, partner financial).
- Vitest + React Testing Library setup and AddEntry regression tests (2 tests).

### Fixed

**Backend**
- JWT access expiry now 15 minutes everywhere (`environment.js` default, `.env.example`,
  `.env`); previously config defaulted to 30m while docs claimed 15m.
- Global XSS sanitizer no longer trims/escapes password fields — credentials with leading
  or trailing spaces are no longer silently corrupted.
- Dead code removed in `userService.createNewUser` (unused lookup).

**Frontend**
- Outtake form no longer retains intake source state: switching to outtake clears
  source/customer/partner and the payload omits them entirely.
- Duplicate warning no longer navigates immediately — a dialog asks the user to confirm
  ("Stay here" / "Continue to transactions"); the entry is saved either way.

### Tests

- Backend suite: 43 → 51 tests (outtake source-state rejection, PATCH update lifecycle
  incl. roles and reversed-record refusal, partner report totals across pages, 15-minute
  JWT expiry assertion).
- Frontend suite: new Vitest component tests for AddEntry type-switch payload hygiene and
  duplicate-dialog behavior.

## [0.1.0] — 2026-08-20

Initial release — first complete implementation of the master spec.

### Added

**Backend**
- PostgreSQL schema via 9 sequential migrations: users, refresh tokens, customers,
  partners, categories, transactions (intake/outtake discriminated by `transaction_type`,
  partner flows by `source_type`), audit logs, app settings; CHECK constraints, partial
  unique indexes, `updated_at` triggers.
- Seed scripts (idempotent): 7 default expense categories, admin user, app settings.
- Auth: bcrypt login, 15-min JWT access token, rotating refresh tokens (sha256-hashed at
  rest, family reuse detection), 5-failure lockout (~15 min), per-route rate limits,
  logout, change-password.
- RBAC: admin / operator / viewer with route-level `authorize` guards.
- Domains: customers (+ ledger), partners (+ ledger), categories (+ active list),
  transactions (create with duplicate detection, list/filter, reverse, delete),
  dashboard summary + category breakdown (server-side cache, invalidated on financial
  mutation), reports (daily, monthly, category range, partner financial), settings,
  users (CRUD, activate/deactivate, reset password), audit log.
- Financial integrity: `numeric(14,2)` everywhere, aggregation excludes deleted/reversed/
  reversal rows, reversals insert offsetting records, admin-password re-entry for
  destructive actions.
- Errors as `{ success:false, error:{ code, message, details? } }`; pino logging; central
  error handler; graceful shutdown.
- Jest + supertest integration suite — 43 tests.

**Frontend**
- Vite 8 + React 19 + Tailwind 4 + React Router 7 scaffold with `/api` proxy.
- Axios client with 401 refresh-queue retry and auto-logout on refresh failure.
- Auth + toast providers; protected routes; role-aware navigation.
- Pages: Login, Dashboard (opening/current balance, FY intake/outtake/net, partner flows,
  outtake-by-category chart, recent entries), Add Entry (intake: customer/partner
  capital/partner loan; outtake: category + payee; duplicate warning), Transactions
  (filter/search/paginate, reverse + delete with admin password), Customers + Customer
  Detail (ledger), Partners + Partner Detail (ledger), Categories (admin CRUD), Reports
  (monthly, daily, category range, partner financial), Settings (admin), Users (admin),
  Audit (admin), 404.
- INR + date formatters; PDF (jsPDF + autotable) and Excel (ExcelJS) export utilities.
- Change-password modal (all roles).

### Fixed
- (First release — no fixes yet.)

### Known limitations
- See `NEXT_TASK.md` (frontend test coverage, deployment).