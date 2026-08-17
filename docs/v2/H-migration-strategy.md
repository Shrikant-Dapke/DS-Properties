# H. DS Properties V2 — Migration Strategy

Goal: transition V1 data → V2 without loss, without destructive changes, with recovery.

## 1. Guiding rules

- **Additive first.** Create all new collections (`users`, `changerequests`, `transactions`, `auditlogs`, `translations`) before any transformation.
- **No destructive mutation** of V1 source collections during migration.
- **Backup before anything.** Full `mongodump` of `ds_properties` to a timestamped archive.
- **Idempotent scripts.** Re-runnable; safe to retry.
- **Verification gates** between steps (counts, checksums of totals).

## 2. Step-by-step

### Step 0 — Backup
```
mongodump --uri="<mongoUri>" --db ds_properties --out ./backup/ds_properties_<timestamp>
```
Store off the working machine. Record `db.stats()` totals.

### Step 1 — Create new collections & indexes
Apply V2 schemas (C-database-design.md). No data moved yet.

### Step 2 — Migrate auth: `admins` → `users`
- Copy each `admin` doc → `user` with `role:'admin'`, `partnerId:null`.
- Preserve `passwordHash`, `active`, `username`, `email`, `name`.
- Keep `admins` collection intact (read-only archive) or drop only after verification.

### Step 3 — Seed Developer user
- CLI `npm run seed:developer` (new script) creates the initial Developer.
- Credentials from env; strong password required in production.

### Step 4 — Migrate Partners → login identities (optional, staged)
- For each existing `partner`, create `user(role:'partner')` and set `partner.userId`.
- If a Partner should NOT have a login yet, leave `userId:null` (business entity only).
- New Partners created in V2 go through `/api/users` (Developer).

### Step 5 — Backfill Finance ledger (`transactions`)
- Script iterates `payments`, `incomes`, `expenses`(deleted:false), `partnercapitals`, `loanreceiveds`.
- Insert `Transaction` per mapping (G-finance-flow.md §2).
- Verify: `Σ transactions.amount(direction:'in')` ≈ V1 dashboard money-received; out matches expenses.
- Idempotent via `(sourceType, sourceId)` uniqueness guard.

### Step 6 — Initialize audit & translations
- `auditlogs`, `translations` start empty (populated at runtime). No historical backfill required for translations.
- Optional: seed an `auditlog` "migration" entry per collection for traceability.

### Step 7 — Verification
- Counts match between source and derived (`transactions` totals vs V1 dashboard).
- Sample reconciliation: pick 5 plots, verify outstanding matches V1.
- Permission smoke test (Phase 1) before exposing V2 roles.

## 3. Rollback / recovery

- Restore from `mongodump` if any step corrupts data:
  ```
  mongorestore --uri="<mongoUri>" --db ds_properties ./backup/ds_properties_<timestamp>
  ```
- Because V1 source collections are never destructively altered, the system can run V1
  until V2 is verified; deploy V2 behind a flag if needed.

## 4. Data that needs special attention

| V1 data | V2 handling |
|---------|-------------|
| Existing `admins` | → `users` role `admin` |
| `partners` (no login) | + `userId` link (optional login) |
| `payments` | unchanged; + `Transaction` + optional `createdBy` |
| `incomes`/`expenses` | unchanged; + `Transaction` |
| `partnercapitals`/`loanreceiveds` (Receipts) | unchanged; + `Transaction` (Money In) |
| `categories` | unchanged |
| `customers`/`plots` | unchanged |

No V1 financial logic is rewritten; the ledger is additive.
