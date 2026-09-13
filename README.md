# DS Properties V4 — Financial Tracking System

A web application for tracking a land-plotting business's finances: customer receipts,
partner capital/loan inflows, and project outtakes, with role-based access, audit logging,
reports, and PDF/Excel exports.

## Stack

- **Backend**: Node.js 24, Express 5 (ESM), PostgreSQL 18, JWT + refresh-token rotation,
  Joi validation, pino logging, node-cache, rate limiting, full audit trail.
- **Frontend**: React 19, Vite 8, Tailwind CSS 4, React Router 7, Chart.js, jsPDF,
  ExcelJS.

## Quick start

Prerequisites: Node 20+, PostgreSQL running locally.

```powershell
# 1. Create the database (one time; local-dev default password only — use a
#    strong unique password in production)
psql -U postgres -h localhost -c "CREATE ROLE dsp_v4 LOGIN PASSWORD 'dsp_v4_password';"
psql -U postgres -h localhost -c "CREATE DATABASE ds_properties_v4 OWNER dsp_v4;"

# 2. Backend
cd backend
npm install
npm run migrate      # apply migrations
npm run seed         # seed admin + categories + settings
npm run dev          # http://localhost:3000

# 3. Frontend
cd ../frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api to :3000)
```

Default admin login: username `admin` with the seeded password (`SEED_ADMIN_PASSWORD`;
see `backend/seeds/002_seed_admin_user.js` for the local-dev default).
Change it immediately after first login — never use the default in production.

## Scripts

| Where | Script | Purpose |
|---|---|---|
| backend | `npm run migrate` | Apply SQL migrations in order |
| backend | `npm run seed` | Insert base categories, admin user, app settings |
| backend | `npm run db:reset` | Drop + recreate dev DB, migrate, seed |
| backend | `npm test` | Jest integration suite (uses `ds_properties_v4_test`) |
| backend | `npm run lint` | ESLint on `src/` |
| backend | `npm run smoke` | In-process API smoke test against dev DB |
| frontend | `npm run dev` / `build` / `lint` | Dev server / production build / lint |
| frontend | `npm test` | Vitest component tests (jsdom) |

> Jest must run with `--experimental-vm-modules` (already wired in `package.json`).

## What's tracked

- **Intakes** — money in, with a source: a customer receipt, partner capital
  contribution, or partner loan.
- **Outtakes** — money out, always with an expense category (e.g. Road Construction,
  Documentation, Labour) and an optional payee.
- Partner capital and partner loans live in the same `transactions` table via a
  `source_type` discriminator — no separate ledger tables.

## Key behaviors

- **Reversals**: an entry can be proposed for reversal by a partner (own-password
  re-entry). The original is marked `reversed_at` and an offsetting `is_reversal`
  record is created once all other active partners approve. Aggregations
  exclude deleted, reversed, and reversal rows, so balances never double-count.
- **Duplicate detection**: entries matching an amount + party + type within 15 minutes
  are flagged with a warning, never rejected.
- **Roles — exactly three account types**: `developer` (owner/maintenance:
  full access, direct apply, provisioned only by the owner outside the API),
  `partner` (business operator: proposes creates/edits/deletes/reversals,
  approves other partners' proposals), `admin` (supervision: views business
  data/reports/audit, manages users and partner membership, cannot mutate
  business data). There is no fourth role.
- **Partner governance**: every business-data mutation (transactions, customers,
  categories, financial settings) becomes a change request requiring unanimous
  approval from ALL OTHER active partners. The requester can never approve
  their own request; approver membership is frozen server-side at creation.
  With no other active partners, proposals fail closed with `409
  NO_PARTNER_QUORUM` — never silently auto-approved.
- **Admin governance**: creating, promoting, demoting, deactivating, deleting,
  or resetting the password of an `admin` requires multi-admin approval; the
  same actions on `partner` users apply immediately (audited).
  Partner business-record membership is also admin-managed. Developer
  accounts cannot be created, modified, or removed through the API at all.
- **Destructive actions**: deleting or reversing an entry requires the
  requesting partner's own password re-entry plus unanimous partner approval,
  and is fully audited. No database-wide destruction endpoint exists.
- **Lockout**: 5 consecutive failed logins locks the account for ~15 minutes.
- **Token security**: 15-minute access tokens, rotating refresh tokens (hashed at rest,
  stored with a family chain for reuse detection).
- **Audit trail**: every meaningful action (login, create, update, delete, reverse,
  settings) is recorded with actor, IP, user agent, and before/after values.
- **Dashboard caching**: aggregate endpoints are cached server-side and invalidated on
  any financial mutation. Cache keys embed the selected date range, so periods never
  bleed across one another.
- **Date-range filtering**: Dashboard, Transactions, and every report tab support Daily /
  Weekly / Monthly / Yearly / Custom quick modes plus From/To. Filtering is enforced by
  the backend (`from`/`to` query params, inclusive, `YYYY-MM-DD`); the UI never filters
  data client-side.

## Project layout

```
backend/
  migrations/         SQL migrations (001..012, incl. roles/governance/partner link)
  seeds/              Seed scripts (categories, admin, settings)
  scripts/            migrate / seed / db-reset / smoke runners
  src/
    config/           env, constants, pg pool
    utils/            errors, logger, pagination, cache
    middleware/       auth, authorize, rate-limit, validate, audit, error handler
    models/           raw SQL per domain
    services/         business logic
    controllers/      HTTP handlers
    validators/       Joi schemas
    routes/           Express routers
  tests/integration/  Jest + supertest suites
frontend/
  src/
    api/              axios client (token refresh queue) + endpoint helpers
    components/       common UI + layout
    contexts/         auth + toast providers
    hooks/
    pages/            login, dashboard, entries, customers, partners, categories,
                      reports, settings, users, audit
    utils/            INR/date formatters, PDF + Excel exporters
```

## API

Express 5, JSON, camelCase bodies/responses. All routes (except `POST /api/v1/auth/*`)
require `Authorization: Bearer <accessToken>`.

- `auth` — login, refresh, logout, change-password
- `customers` — CRUD + ledger (`GET /customers/:id/ledger`)
- `partners` — CRUD + ledger
- `categories` — CRUD + `GET /categories/active`
- `transactions` — CRUD + `POST /transactions/:id/reverse` (partner role only;
  every mutation becomes a change request needing unanimous approval from all
  other active partners; delete/reverse need the requester's own password
  re-entry; `PATCH /:id` edits via the same flow; `versionTag` optimistic
  concurrency — stale tag returns `409 STALE_CONFLICT`, empty quorum returns
  `409 NO_PARTNER_QUORUM`; list accepts optional `?from&to`)
- `dashboard` — summary + category breakdown (cached; both accept `?from&to`)
- `reports` — daily (`?from&to`), monthly (`?year&month` or `?from&to`), category range
  (`?from&to`), partner financial (`/:id?from&to`, optional range)
- `settings` — list (admin/read_only/partner); update (partner-governed)
- `users` — CRUD, activate/deactivate, reset password, partner-identity linking
  (admin/developer; the developer role is never assignable via the API)
- `audit` — paginated audit log (admin/partner/developer)

Responses are `{ success: true, data }`; list endpoints return
`data = { rows, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`.
Errors are `{ success: false, error: { code, message, details? } }`.