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
# 1. Create the database (one time)
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

Default admin login: **admin / Admin@123** (change it after first login).

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

> Jest must run with `--experimental-vm-modules` (already wired in `package.json`).

## What's tracked

- **Intakes** — money in, with a source: a customer receipt, partner capital
  contribution, or partner loan.
- **Outtakes** — money out, always with an expense category (e.g. Road Construction,
  Documentation, Labour) and an optional payee.
- Partner capital and partner loans live in the same `transactions` table via a
  `source_type` discriminator — no separate ledger tables.

## Key behaviors

- **Reversals**: an entry can be reversed (admin + password re-entry). The original is
  marked `reversed_at` and an offsetting `is_reversal` record is created. Aggregations
  exclude deleted, reversed, and reversal rows, so balances never double-count.
- **Duplicate detection**: entries matching an amount + party + type within 15 minutes
  are flagged with a warning, never rejected.
- **Roles**: `admin` (everything), `operator` (create/edit entries, customers, partners),
  `viewer` (read-only). Destructive actions (delete/reverse entries, delete records)
  require admin.
- **Lockout**: 5 consecutive failed logins locks the account for ~15 minutes.
- **Token security**: 15-minute access tokens, rotating refresh tokens (hashed at rest,
  stored with a family chain for reuse detection).
- **Audit trail**: every meaningful action (login, create, update, delete, reverse,
  settings) is recorded with actor, IP, user agent, and before/after values.
- **Dashboard caching**: aggregate endpoints are cached server-side and invalidated on
  any financial mutation.

## Project layout

```
backend/
  migrations/         SQL migrations (001..009)
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
- `transactions` — CRUD + `POST /transactions/:id/reverse` (admin password required for
  delete/reverse)
- `dashboard` — summary + category breakdown (cached)
- `reports` — daily, monthly, category range, partner financial
- `settings` — list/update app settings (admin)
- `users` — CRUD, activate/deactivate, reset password (admin)
- `audit` — paginated audit log (admin)

Responses are `{ success: true, data }`; list endpoints return
`data = { rows, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`.
Errors are `{ success: false, error: { code, message, details? } }`.