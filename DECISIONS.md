# DECISIONS

Record of notable design decisions and their rationale. Reverse-chronological.

## 1. No separate partner ledger tables — discriminated single `transactions` table

Partner capital and partner loans are rows in `transactions` with `source_type =
'partner_capital' | 'partner_loan'` and a `partner_id` FK, instead of dedicated
`partner_capital` / `partner_loan` tables.

**Why**: Partner money is a financial transaction like any other — same amount, date,
mode, notes, reversal semantics. Single-table design keeps balance computation,
reversals, duplicate detection, reports, and audit in one code path, dramatically
reducing surface area for off-by-one/balance bugs. `customer_intake` and
`partner_*` are distinguished by `source_type`, which the serializers map to the
spec's category labels.

## 2. Aggregation excludes `deleted`, `reversed`, and `reversal` rows

Every balance/report query filters `deleted_at IS NULL AND reversed_at IS NULL AND
is_reversal = false`. Reversals insert an offsetting `is_reversal` row and stamp the
original with `reversed_at`.

**Why**: soft-delete + explicit reversal offsets means the ledger can never double-count
and each entry remains auditable; original and reversal rows stay visible in the detail
view for forensic clarity.

## 3. Reversals are forced offsets, not deletions

`POST /transactions/:id/reverse` (admin + password required) creates a mirrored negative
entry. No "void in place".

**Why**: a reversal is a *new* event that must itself be audited, dated, and reasoned
about. Mutating the original breaks the audit trail and the ledger.

## 4. Delete/reverse require admin password re-entry

Body carries `{ adminPassword }`, verified before the mutation.

**Why**: destructive financial actions need a second factor beyond the session token;
cheap to implement, high protection value.

## 5. Duplicate detection is a warning, never a block

Transactions matching amount + party + type within the last 15 minutes return
`duplicateWarning: true` plus the matching rows; the API still creates the entry.

**Why**: same-day duplicates in cash businesses are common and often legitimate
(separate receipts). Blocking would frustrate; warning informs.

## 6. One access token + rotating refresh token with family reuse detection

15-minute JWT access; refresh token hashed (sha256) at rest with `family_id` chain;
reuse of a rotated token invalidates the whole family (possible theft signal).

**Why**: spec requires "logout all devices" and session management; family-chain rotation
is a lightweight, standard improvement over bare rotation.

## 7. `numeric(14,2)` for all money, exact arithmetic, INR formatting client-side

Money never crosses a float boundary in Postgres or JS math paths; frontend formats via
`Intl.NumberFormat('en-IN')`.

**Why**: currency bugs are the most expensive class of bug in financial software.

## 8. ESM throughout (backend) + `--experimental-vm-modules` Jest

Backend is pure ESM; tests run through `node --experimental-vm-modules`.

**Why**: consistent with modern Node; avoids dual-module hazard. The flag is wrapped in
`npm test` so nobody needs to remember it.

## 9. JWT + refresh tokens in `httpOnly` cookies, with a mobile-friendly fallback

Spec requires app usage (possibly via web view). Cookies work in browsers; the API also
accepts `accessToken` in the `Authorization` header for non-browser clients. Frontend
uses header-based auth (simplest for a web-only deliverable).

**Why**: keep the door open for mobile while shipping a browser-first product.

## 10. Express 5's read-only `req.query` handled in a single middleware

`validate(..., 'query')` mutates `req.query` in place (delete + `Object.assign`) because
Express 5 defines it as a getter-only property.

**Why**: prevents `Cannot set property query` crashes and keeps request-shape
normalization in one place.

## 11. Seed data is minimal and idempotent

Seven expense categories (Road Construction, Land Documentation, Labour, Office Expense,
Government Tax, Security & Maintenance, Miscellaneous), one admin, a small settings set.
Seeds upsert by unique key.

**Why**: the business can adjust categories freely; a heavy default taxonomy would be
opinionated noise.

## 12. Frontend reports are read-only views; exports deferred

Reports page renders daily/monthly/category/partner views. PDF/Excel utilities ship but
aren't wired to buttons yet (see NEXT_TASK).

**Why**: keeps scope honest; exports are a thin layer over already-built data views.