# CHANGELOG

All notable changes to DS Properties V4.

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
- See `NEXT_TASK.md` (report export buttons, frontend tests, deployment).