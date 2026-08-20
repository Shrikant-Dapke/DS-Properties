# CHANGELOG

All notable changes to DS Properties V4.

## [0.2.0] — 2026-08-20

Consistent date-range filtering across Dashboard, Transactions, and Reports: every page
that lists, aggregates, or reports transactions now supports Daily / Weekly / Monthly /
Yearly / Custom quick modes (plus From/To), with the backend as the single source of truth
for filtering.

### Added

**Backend**
- `from` / `to` query parameters on transactions list, partner ledger, dashboard summary +
  category breakdown, and the monthly / category-range / partner-financial reports.
- Monthly report accepts either `year` + `month` (existing) or `from` + `to` (new,
  takes precedence).
- Dashboard `summary` response gains a `period` object with `from`, `to`, `openingBalance`
  (settings opening balance + net up to the day before the period), and the period's
  intake / outtake / net / customer intake / partner capital / partner loan / counts;
  `recentTransactions` is scoped to the selected period.
- New shared validators: `optionalDateRangeSchema` / `requiredDateRangeSchema`,
  `dateOrderCheck` (rejects `from > to`), `dateRangePresenceCheck` (both or neither);
  list endpoints allow single-sided ranges, aggregate/report endpoints require both or
  neither.
- Cache keys for dashboard summary and category breakdown now embed `from` / `to`, so
  ranges never bleed across one another; `invalidateFinancialCache()` clears all
  `financial:*` entries on any financial mutation.
- New `utils/dateRange.js` (`financialYearRange`, `addDays`, `assertValidRange`).

**Frontend**
- New reusable `DateRangeFilter` component (Daily / Weekly / Monthly / Yearly / Custom +
  From/To) with inline validation ("From date must not be after To date", "Select both
  From and To dates"). It skips no-op mount emissions and never emits a half-filled
  custom range.
- Shared `utils/dateRange.js` (`DATE_MODES`, `financialYearRange`, `isoWeekRange` Monday
  start, `monthRange`, `rangeForMode`, `isValidRange`, `formatRangeLabel`).
- Dashboard: default current financial year (Apr–Mar), period stat cards, range-aware
  chart + recent entries.
- Transactions: From/To replaced by `DateRangeFilter` (Custom + All dates default);
  selecting a mode or filling a custom range auto-applies and resets pagination.
- Reports: monthly tab uses Monthly mode, categories tab uses Yearly mode, partner tab
  uses Custom (+ All dates); export subtitles show the active range.

### Tests

- Backend: 14 new integration tests (`tests/integration/dateRange.test.js`) covering
  inclusive boundaries, `from > to` rejection, malformed dates, monthly `from/to` ===
  `year+month` equivalence, single-sided rejection, category report ordering, partner
  range scoping, dashboard FY default, period aggregates + opening carry-forward,
  cache isolation across ranges, and create/update/reverse cache invalidation. Suite
  total: 65 tests.
- Frontend: 22 `utils/dateRange` unit tests + 7 `DateRangeFilter` component tests. Suite
  total: 44 tests.

### Verified

- Live API against the dev DB (seeded fixture data): FY, monthly, weekly, daily, and
  custom ranges all return correct intake/outtake/net/opening numbers; transactions list,
  reports, category breakdown, and partner report all honor the range.
- Live browser: login → dashboard renders with the FY default (`2026-04-01` –
  `2027-03-31`); switching to Monthly / Weekly / Custom issues backend requests with the
  exact expected `from`/`to`; Transactions auto-applies the selected range and resets
  pagination; Reports monthly/categories/partner tabs each send their default or custom
  range.

## [0.1.2] — 2026-08-20

Critical session-stability fix — "Save Entry → redirected to Login" regression.

### Fixed

**Frontend**
- Session no longer destroyed on transient refresh failures. The 401-refresh
  interceptor only clears tokens and redirects to `/login` when the refresh
  endpoint returns a genuine 401 (invalid/expired refresh token); rate-limit
  (429), server (5xx) and network failures now preserve the session and surface
  the error so the next attempt can retry.
- Refresh calls are single-flight: concurrent callers (401 interceptor, session
  restore, StrictMode double-mount, multiple tabs) share one in-flight refresh,
  so the refresh token is never rotated twice with the same value (which the
  server's reuse detection treats as theft).
- Session restore no longer refreshes on every page load: when the access token
  is still valid and the user is cached, restore is offline. This stops the app
  from burning the auth rate limit (20 requests / 15 min, shared by login +
  refresh) on reloads — the cause of refresh 429s at save time.

### Tests

- Frontend suite: new live-backend integration tests for the auth client
  (`client.integration.test.js`, auto-skipped when the backend is down):
  login stores tokens + user; expired access token → exactly one refresh →
  original request retried successfully; restore with valid token makes zero
  network calls; concurrent restores share one refresh; revoked refresh token →
  401 → session cleared without redirect; transient 429 → tokens preserved, no
  redirect. Suite total: 15 tests (9 component + 6 integration).

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