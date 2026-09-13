# DS Properties V4 — Client Handoff Guide

Practical operating instructions for the system owner. pairs with `README.md`
(developer quick start) and `backend/.env.example` (all settings).

## 1. First-time production deployment

### 1.1 Prerequisites

- Node.js 20+ on the app host, PostgreSQL 16+ reachable from it.
- A static file host (or the same host) for the frontend `dist/` output.
- HTTPS in front of both services (reverse proxy recommended).

### 1.2 Environment — backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and set **every** value below.
Never reuse development values in production.

| Variable | Production requirement |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` / `API_PREFIX` | host port and `/api/v1` (defaults are fine) |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | managed Postgres; **strong unique `PGPASSWORD`** |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | long random strings, unique per environment |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | `15m` / `7d` (defaults) |
| `SEED_ADMIN_PASSWORD` | **strong unique password, set BEFORE the first `npm run seed`** |
| `CORS_ORIGIN` | exact production frontend origin(s), comma-separated |
| `TRUST_PROXY` | `true` when running behind a reverse proxy, else `false` |
| `OPENING_BALANCE` | opening cash balance used by dashboard/reports |

### 1.3 Environment — frontend (build time)

- `VITE_API_BASE` — full backend API URL, e.g. `https://api.example.com/api/v1`.
  When unset, the app uses same-origin `/api/v1` (configure the proxy accordingly).

### 1.4 Database setup (one time, in order)

```powershell
cd backend
npm install
npm run migrate   # applies backend/migrations/001..010 in order
npm run seed      # categories + initial admin user + app settings
```

### 1.5 Start

```powershell
cd backend
npm start          # serves the API (default http://localhost:3000)

cd ../frontend
npm install
npm run build      # outputs frontend/dist/ — serve over HTTPS
```

### 1.6 Immediately after first login

1. Log in as `admin` with `SEED_ADMIN_PASSWORD`.
2. Change the password (sidebar → change-password, or
   `POST /api/v1/auth/change-password`). The old password stops working at once
   and all refresh tokens are revoked.
3. Treat `SEED_ADMIN_PASSWORD` as single-use: it is only read by the seed script.

## 2. Daily operation (user guide summary)

- **Login** — username + password. 5 wrong attempts lock the account ~15 minutes.
- **Dashboard** — balances for the selected period (defaults to the financial year
  starting April). Use the date filter for custom ranges.
- **Add Entry** (partners) — Intake (customer receipt / partner capital /
  partner loan) or Outtake (expense category + payee required). Saving submits
  a change request: nothing applies until all other active partners approve it
  on the **Approvals** page. A "possible duplicate" dialog is a warning only.
- **Transactions** (partners) — search/filter, click a row for details, Edit,
  Reverse, or Delete. Everything is a proposal: Reverse/Delete ask for your own
  password again and are audited. If you see *"Transaction changed since you
  loaded it"* (`STALE_CONFLICT`), someone else modified the entry — reload and
  retry.
- **Reports** — Monthly/Daily/Categories/Partner tabs with PDF/Excel export.
  If a period shows *"Showing the first 1,000 of N transactions"*, narrow the
  date range; the summary totals always cover the full period.
- **Customer / Partner ledgers** — per-party history; totals match the reports.
- **Language** — English / Marathi switcher in the navigation.

## 3. Administration (admin guide summary)

There are exactly three account types: `developer`, `partner`, `admin`.

- **Developer (owner only)** — full access, applies business changes directly
  without partner approval. Provisioned ONLY via `SEED_DEVELOPER_*` on a fresh
  database or `npm run provision-developer` on an existing one (both need
  owner shell + secrets). Can never be created, promoted-to, modified, or
  deleted through the application by anyone, including admins. Rotate via
  change-password (self) or `provision-developer --reset`.
- **Roles** — `partner` (business-data operator: proposes every create/edit/
  delete/reverse; approves other partners' proposals), `admin` (supervises:
  views business data, reports, audit; manages users and partner membership;
  cannot mutate business data).
- **Partner governance (business data)**: transactions, customers, categories,
  and financial settings. A proposal shows *"Submitted for partner approval"*
  and appears under **Approvals** as `PENDING`. **All other active partners
  must approve** (quorum = every active partner except the requester, frozen
  at creation); the requester can never approve their own request, and one
  rejection stops execution. With no other active partners, proposals fail
  with `409 NO_PARTNER_QUORUM` — escalate membership to an admin instead.
- **Partner identity**: each partner login is linked to exactly one partner
  record (Users page, admin-only). Deactivating a partner user or record
  removes them from future quorums; in-flight requests keep their frozen
  approver set.
- **Sensitive admin operations need multi-admin approval**: creating an admin,
  promoting to admin, demoting an admin, deactivating an admin, deleting an
  admin, resetting an admin's password. **Every active admin must approve**;
  the requester counts as one. The same actions on `read_only`/`partner`
  users apply immediately (audited).
- **Approvals page** — approve or reject with an optional comment; progress
  shows as e.g. `2/3`. A pending request can be cancelled by the requester or
  any required approver.
- **Safety rails** — you cannot deactivate or delete your own account.
- **Audit page** — every login, mutation, approval, and password event with
  actor, IP, and before/after values. Append-only; there is no delete function.
- **Settings page** — editable app settings (e.g. opening balance). Changes to
  the opening balance immediately affect dashboard/report balances.

## 4. Backup and recovery

- **Backup**: schedule `pg_dump` of the production database daily and keep
  off-host copies, e.g.
  `pg_dump -h <host> -U <user> ds_properties_v4 > dsp_$(date +%F).dump`.
- **Restore**: create an empty database, restore the dump, then
  `npm run migrate` (migrations are idempotent-ordered) and restart the API.
- **Secrets backup**: store production `.env` values in the owner's password
  manager — they are not in the repository and cannot be recovered from it.

## 5. Credential rotation

- **Admin password**: change-password flow (self) or Users → reset password
  (another admin; resets of admin passwords go through approval).
- **JWT secrets**: set new values, restart the API. All sessions are invalidated
  (users log in again) — plan a maintenance window.
- **Database password**: rotate in Postgres and `PGPASSWORD` together, restart.
- **Seed password**: `SEED_ADMIN_PASSWORD` is only used by `npm run seed` on a
  fresh database; rotating it later has no effect on existing users.

## 6. Troubleshooting

| Symptom | Likely cause → resolution |
|---|---|
| `Account is temporarily locked` (423) | 5 failed logins → wait ~15 min, or another admin resets the password |
| `Invalid or expired access token` after idle | access token is 15 min by design; the app refreshes silently — if refresh also expired (7 days), log in again |
| `409 STALE_CONFLICT` on edit/delete/reverse | entry changed since opened → reload the row and retry |
| `403` for a `read_only` user | expected — read_only cannot mutate, approve, or admin-manage |
| `403` for an `admin` on create/edit/delete/reverse | expected — admins supervise business data but cannot mutate it; use a partner login |
| `403` for a `partner` on user management | expected — partners operate business data; only admins/developers manage users |
| `409 NO_PARTNER_QUORUM` on propose | sole active partner (or none besides you) — ask an admin to activate another partner, then retry |
| `429 RATE_LIMITED` | >20 auth or >300 general requests / 15 min → wait and retry |
| Report list shorter than expected | 1,000-row display cap with on-screen notice → narrow the range; totals are unaffected |
| Dashboard numbers look stale | aggregates cache ~30–60 s and invalidate on every financial write; hard-refresh after waiting a minute |
| `API 404 Route … not found` | wrong `VITE_API_BASE` or proxy → point it at `/api/v1` of the backend |
| Smoke test fails on login | dev DB was re-seeded or password changed → set `SMOKE_ADMIN_USERNAME`/`SMOKE_ADMIN_PASSWORD` to match |

## 7. What is intentionally NOT in this release

- No Dockerfile/CI (see `NEXT_TASK.md` §3 — needs Docker or a cloud DB).
- No automated `pg_dump` schedule script (see `NEXT_TASK.md` backlog).
- No URL-persisted report ranges, no forced first-login password change, no
  offline/PWA mode (all deferred by design, see `NEXT_TASK.md`).
