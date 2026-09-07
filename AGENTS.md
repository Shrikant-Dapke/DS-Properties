# AGENTS.md — DS Properties

> **Project-wide source of truth for all agents (human + AI) working in this repository.**
> Every specialist subagent (`.opencode/agents/*`) must follow this file.
> OpenCode's primary Build/Plan workflow remains the default entry point; the five
> specialists are invoked via `@mention` or the Task tool for their phase of the work.

## 0. Source-of-truth hierarchy (conflict resolution)

When sources disagree, this order wins:

1. **Actual source code** (`server/src`, `client/src`) + **actual DB behavior**
2. **This AGENTS.md**
3. **`docs/v2/`** (audited V1 reality + V2 blueprint: `FINAL-REPORT.md`, `B-architecture.md`,
   `C-database-design.md`, `D-api-plan.md`, `E-permission-matrix.md`,
   `F-partner-approval-flow.md`, `G-finance-flow.md`, `PHASE1-NOTES.md`, `PHASE2-NOTES.md`)
4. **`PROJECT.md`** — frozen project context. It is **stale in places**: it says "fresh start,
   no code" (§2, §23) yet the codebase is complete, and says "admin-only" (§11) yet three
   roles (`developer|partner|admin`) are implemented. Never let PROJECT.md override 1–3.

When documentation conflicts with the codebase: inspect the code, verify actual behavior,
ask the user if a business rule affecting stored financial/property data is at stake,
then update documentation after the decision.

## 1. Project purpose

DS Properties is a property/plotting business management system for an administrator:
customers, plots, plot allocation, customer payments, outstanding amounts, general income,
expenses + categories, dashboard, and reports — one internal application.

Priority order (non-negotiable): data correctness > customers > plots > payments >
financial accuracy > reports > usability > visual polish > animation.
A beautiful UI with incorrect payment/balance data is unacceptable.

## 2. Repository structure (actual)

```text
DS Properties/
├── AGENTS.md                 ← this file (source of truth for agents)
├── PROJECT.md                ← frozen context (stale in places, see §0)
├── opencode.json             ← OpenCode config (ponytail plugin only). DO NOT EDIT without approval.
├── skills-lock.json          ← skill registry. DO NOT EDIT.
├── .opencode/agents/         ← the five specialist subagents (this system)
├── .agents/skills/           ← vendored web-design-guidelines copy. DO NOT EDIT/DELETE.
├── skills/                   ← web-design-guidelines + apple-design. DO NOT EDIT/DELETE.
├── .gstack/                  ← gitignored runtime logs only. Ignore.
├── client/                   ← React 18 + Vite 5 frontend (see §3)
│   └── src/{App.jsx,main.jsx,components/,layouts/,pages/,routes/,services/,
│             context/,hooks/,lib/axios.js,utils/}
├── server/                   ← Express + Mongoose 8 backend (see §4)
│   └── src/{app.js,server.js,config/,controllers/,middleware/,models/,
│             routes/,services/,utils/,scripts/}
│   └── tests/                ← node:test integration suites (see §8)
└── docs/v2/                  ← V2 blueprint + phase notes. DO NOT EDIT without approval.
```

No root `package.json`. Frontend and backend have independent `package.json` files.

## 3. Frontend architecture

- **Stack:** React 18, Vite 5, React Router 6, Tailwind 3 (DS color system), axios,
  lucide-react (outline icons, consistent stroke). No Redux. No UI framework swaps.
- **Conventions:**
  - API calls live in per-domain `client/src/services/*.service.js` — never scatter raw
    axios calls through components (`client/src/lib/axios.js` is the single instance:
    baseURL `VITE_API_URL || '/api'`, Bearer interceptor, 401 → `/login` redirect).
  - Reusable UI in `client/src/components/` (Card, Button, Badge, Field, FilterPanel,
    DeleteConfirmModal, Skeleton, Spinner, Toast, EmptyState, ErrorState).
  - `AuthContext` (`client/src/context/AuthContext.jsx`) exposes `user/token/role/id`,
    `isDeveloper/isPartner` helpers. **Authorization is backend-enforced; these helpers
    are UI/routing only.**
  - `RequireAuth` (`client/src/routes/RequireAuth.jsx`) gates all app routes.
    Nav gating lives in `client/src/layouts/AppLayout.jsx` (Approvals visible to
    partner/developer only).
  - Routes in `client/src/App.jsx`: customers, plots, payments, expenses, income,
    categories, partners, receipts, finance, approvals, reports + login.
  - Every data view handles loading / empty / error / success states. Tables use
    `overflow-x-auto`. Keep the Folio-derived visual system (DM Serif Display / DM Sans /
    Space Mono; Indigo primary, Mint success, Orange alert, Navy base, Chalk surfaces).
- **For UI polish/review work**, reuse the existing `web-design-guidelines` skill
  (do not reinstall or duplicate it).

## 4. Backend architecture

- **Stack:** Node + Express 4 + Mongoose 8 + JWT + bcryptjs + helmet + cors +
  decimal.js + exceljs + pdfkit. Stay on it (no Atlas, no microservices, no rewrites).
- **Layering (mandatory):** `routes/` (thin: `authenticate → authorize(role) →
  controller`) → `controllers/` (request handling) → `services/` (business logic) →
  `models/` (Mongoose). Money helpers in `utils/money.js`, envelope in
  `utils/response.js`, errors via `AppError` + central `errorHandler`.
- **Route groups** (`server/src/app.js`): `/api/health, /auth, /customers, /partners,
  /capital, /loans, /plots, /payments, /categories, /expenses, /income,
  /dashboard, /reports, /change-requests, /finance`. Approvals are an alias router
  over change-requests (no create on the alias).
- **Deviations that are INTENTIONAL — do not "fix":**
  - Entity endpoints (`/api/plots`, etc.) remain **Developer-only**; Partner mutations
    go through the dedicated `POST /api/change-requests` endpoint (see §6 and
    `docs/v2/PHASE2-NOTES.md`). Wiring every entity PUT/POST to auto-emit change
    requests was deliberately rejected to limit V1 regression blast radius.

## 5. API conventions

- REST + JSON. Success envelope `{success, message, data}`; failures
  `{success:false, message, errors?}`. Never leak stack traces / raw DB errors
  (500s are sanitized in production).
- `GET` read · `POST` create · `PUT` update · `DELETE` delete. Validate every input
  before touching MongoDB; return precise status codes (400 validation, 401 anonymous,
  403 wrong role, 404 missing, 409 conflict e.g. overpayment / stale commit).
- Finance reads: `GET /api/finance/transactions?direction=in|out&sourceType=&dateFrom=&dateTo=`,
  `/money-in`, `/money-out`, `/summary`. Dashboard/reports are official-data only
  (pending excluded). Health `GET /api/health` is public.

## 6. Database conventions + inviolable financial rules

- Mongoose models; references (`Plot.customerId → Customer`, `Payment.customerId/plotId`,
  `Expense/Income.categoryId → Category(type-matched)`, `User.partnerId → Partner`).
  Single `Category` collection with `type: "expense"|"income"` (no split collections).
- **Money:** `Decimal128` everywhere + `decimal.js` arithmetic (`utils/money.js`).
  Never JS floats. `parseAmount` (> 0 required), `parseDate` required.
- **Derived, never stored:** `Outstanding (per plot) = Plot.price − Σ(payments for plot)`.
  `Plot.price` is the final negotiated price (required, Decision 007). No separate
  agreement-price field. `Operating Income Result = Income − Expenses` — never merged
  with Payments Received / Outstanding Receivables (Decision 020).
- **Cardinality (V1):** one customer → many plots; one plot → at most one customer
  (`customerId` nullable while Available); every Payment has BOTH `customerId` + `plotId`;
  no unallocated/customer-only payments; no joint-owner plots.
- **Guards (backend-enforced):** payment customer MUST equal plot customer (400);
  payment must NOT exceed remaining outstanding — no V1 overpayments (409);
  cannot pay on unassigned plot (400). Payment writes run in a MongoDB transaction
  with ledger write-through (`services/payment.service.js`, `services/finance.service.js`).
- **Correction policy:** expenses soft-delete (`deleted:true`, ledger entry removed);
  payments have NO normal destructive delete; never silently alter history — explicit
  correction/reversal records only. Plot statuses (`Available|Reserved|Allocated|Sold`)
  have NO automatic transition rules yet.
- **Ledger:** additive `Transaction` collection (write-through from source services +
  one-time backfill). Source collections stay the system of record. Receipts =
  Capital + Loans view.

## 7. Authentication / authorization / governance (SECURITY-CRITICAL)

- **Roles:** `developer` (system owner, full CRUD, outside approval) ·
  `partner` (operates via ChangeRequest + approves others' requests, never own) ·
  `admin` (strictly **read-only**, API-enforced 403 on every mutation).
  See `docs/v2/E-permission-matrix.md` + `server/src/middleware/roles.js:14`
  (`WRITE_ROLES = [developer]` in the current phase).
- **Identity:** `authenticate` (`middleware/auth.js`) loads `User` from the verified JWT
  (`{sub, role, pid?}`), rejects inactive accounts. Role is ALWAYS read from the
  backend-loaded `req.user` — never from any client-supplied value.
- **ChangeRequest lifecycle:** `PENDING → (all required approve) → APPROVED → COMMITTED`;
  any rejection (reason required) → `REJECTED` (resubmit creates a NEW request);
  requester/developer may cancel → `CANCELLED`. Required approvers =
  `activePartnerUserIds − requestedBy`, recomputed at approval time (handles membership
  change); sole-active-partner requests auto-commit. Update commits carry an optimistic
  concurrency check (stale official value → 409). Commit runs in a transaction; audit
  rows written on approve/reject/commit.
- **Isolation guarantees:** official entities are untouched until commit (delta lives in
  the ChangeRequest); Admin GETs therefore never see pending — no overlay, no flags on
  official models. Developer IDs are never in the approver set; `approve` endpoints
  reject non-partner roles; Admin gets 403 on all `/api/change-requests` + `/api/approvals`.
- **Login:** single `POST /api/auth/login` (username + password → JWT). No public
  registration, no `/setup` endpoint. Admin seeding via CLI scripts only
  (`seed:developer`, `migrate:admins`, `seed:partner-users`, `seed:categories`).
- **Threats every change must be checked against:** privilege escalation (role spoofing,
  self-approval, developer-as-approver), IDOR (swapping `entityId/customerId/plotId/
  partnerId` to touch another party's records), authorization bypass (missing
  `authorize()`, client-side-only gating), pending-data leakage to Admin, JWT/secret
  exposure, plaintext passwords (bcryptjs only).

## 8. Testing / build commands

```text
# Backend tests (needs local replica set rs0 on 127.0.0.1:27018 running):
cd server && node --test tests/utils.test.js          # lightest, no DB writes of note
cd server && node --test tests/phase2.test.js         # approval/audit E2E
cd server && node --test tests/phase3.test.js         # finance ledger E2E
cd server && node --test tests/phase3-atomicity.test.js tests/phase3-finance.test.js tests/payment-sum.test.js
# Frontend: no test runner — verify with:
cd client && npm run build                            # vite build must pass
# Full backend suite (runs all of tests/):
cd server && node --test tests/
```

- Suites use `node:test` + live HTTP against an ephemeral port and throwaway DBs
  (never the dev `ds_properties` DB; `after()` calls `dropDatabase`). Mongo URI pattern:
  `mongodb://127.0.0.1:27018/ds_properties?replicaSet=rs0` (dev) — tests rewrite the DB
  name. Never run tests against production data.
- Never delete/weaken a test to force green. Failing test → fix the code or prove the
  test's expectation contradicts §6/§7 and get human approval before touching the test.

## 9. Development conventions

1. Inspect first (`read/glob/grep`, actual files — never assume from PROJECT.md).
2. Understand existing patterns; reuse helpers in `server/src/utils/` and
   `client/src/components|services|utils|hooks` before writing new ones.
3. Smallest correct change that solves the task. No unrelated refactors, no pattern
   swaps, no dependency adds without stated justification.
4. Keep routes thin / logic in services / money via `money.js` / envelope responses.
5. Test it (§8). Inspect the final diff (`git diff --stat`, `git status --short`).
6. Report exactly what changed (files + behavior + verification + remaining issues).
   Never claim a test/build ran unless it did.

## 10. Important files / modules (start here)

```text
server/src/app.js                  route mounting + middleware order
server/src/middleware/auth.js      JWT → User resolution (authoritative identity)
server/src/middleware/authorize.js role gate (401/403)
server/src/middleware/roles.js     ALL_ROLES / WRITE_ROLES  ← permission heart
server/src/models/User.js          roles, partnerId link, active flag
server/src/models/ChangeRequest.js approval workflow state
server/src/models/AuditLog.js      append-only audit trail
server/src/models/Transaction.js   finance ledger
server/src/services/changeRequest.service.js  approval/commit engine (446 lines — read fully before touching)
server/src/services/finance.service.js        ledger write-through + runInTransaction
server/src/services/payment.service.js        overpayment/customer-match guards
server/src/utils/money.js          Decimal128 + parseAmount/parseDate + PAYMENT_METHODS
server/src/utils/response.js + errors.js + middleware/errorHandler.js  API contract
client/src/App.jsx                 route tree
client/src/context/AuthContext.jsx role helpers (UI-only)
client/src/lib/axios.js            API client singleton
client/src/routes/RequireAuth.jsx  route gate
client/src/layouts/AppLayout.jsx   nav + role gating
```

## 11. Hard prohibitions (all agents)

- No rewrites, no unrelated refactors, no replacing working architecture for preference.
- No weakening auth/authZ/governance; no bypassing approval; no client-side-only gating.
- No API contract changes (envelope, routes, statuses) without justification + approval.
- No PostgreSQL, no Atlas, no microservices, no Redux, no extra roles, no new deps
  without justification.
- No touching `.env` contents, secrets, `node_modules/`, `dist/`, `*.log`/`*.err`,
  `server/data/`, `opencode.json`, `skills-lock.json`, `PROJECT.md`, `docs/v2/`,
  `skills/`, `.agents/` — unless the approved task explicitly says so.
- No destructive DB operations without confirmation. No modifying unrelated files.
- Never fabricate files/APIs/collections/features or claim unverified work is complete.

## 12. Verification requirements (every implementation task)

Builder: run the relevant suite from §8 + `vite build` for frontend changes; end with
`git diff --stat` + `git status --short` self-inspection and report files/behavior/
verification/gaps. QA/Reviewer/Security re-verify from the diff, not from claims.

## 13. Specialist agents (`.opencode/agents/`, `mode: subagent`)

| Agent | File | Boundary |
|---|---|---|
| ARCHITECT | `.opencode/agents/architect.md` | READ-ONLY. Design + affected files + risks before code. |
| BUILDER | `.opencode/agents/builder.md` | ONLY writer. Smallest correct change + tests + diff. |
| REVIEWER | `.opencode/agents/reviewer.md` | READ-ONLY. Bugs, regressions, consistency, scope creep. |
| SECURITY | `.opencode/agents/security.md` | READ-ONLY. AuthN/Z, roles, ADMIN ops, governance, IDOR/escalation. |
| QA | `.opencode/agents/qa.md` | READ-ONLY (+ test-only edits only when explicitly tasked). Coverage, regressions, edges. |

Invoke via `@architect`, `@builder`, `@reviewer`, `@security`, `@qa` or the Task tool.
Each agent's prompt restates its boundary; AGENTS.md wins on any conflict.

## 14. Workflows

**Normal feature:** `Plan (primary) → @architect → human approves design →
@builder → @qa → @reviewer → @security → human approval/merge.` Security runs last
so it reviews the final diff. Human is the merge authority — agents never merge.

**Large/experimental (Orca worktrees, docs-only — no automation scripts):**

```text
git worktree add ../ds-<approach> -b <branch> <base-sha>   # A, B, C from ONE agreed base
# …run the normal chain inside each worktree independently…
git diff --stat main...<branch>                             # per-worktree summary
# Compare A/B/C diffs + architect table, keep the best, delete the rest:
git worktree remove ../ds-<approach>                        # only after human decision
```

Rules: one approach per worktree; same base SHA (record it in the task brief —
`main` is currently diverged `ahead 10, behind 7`, so the base must be explicit);
no automatic merging, no cross-worktree cherry-picks by agents; human picks the winner.

## 15. Known issues — flag, don't silently fix

- `AuthContext` has `isDeveloper/isPartner` but no `isAdmin` helper.
- `RequireAuth.jsx` currently takes only `children`, though PHASE1-NOTES describes a
  `roles` prop — role gating today is backend + nav-level.
- `LoanReceived.js` duplicate `lender` index warning (pre-existing, harmless, documented
  in PHASE1-NOTES). Fix only in an approved maintenance pass.
- `PROJECT.md` staleness (§0). `main` divergence (`ahead 10, behind 7`) + one locked
  Orca worktree — agree on base SHA before parallel work.
