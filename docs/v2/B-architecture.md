# B. DS Properties V2 — Architecture Document

This document defines the **proposed V2 architecture**. It builds on the audited V1
codebase (see `FINAL-REPORT.md` §Current V1 Reality) and changes only what V2 requires.

---

## 1. Frontend Architecture (proposed)

**Stack (unchanged):** React 18 + Vite 5 + React Router 6 + Tailwind 3 + axios + lucide-react.

Proposed additions (all additive, no rewrite of working V1 pages):

- **`AuthContext`** gains `user.role` and permission helpers (`can()`, `isDeveloper`, `isPartner`, `isAdmin`).
- **`RequireAuth`** becomes role-aware: `RequireRole(['partner','admin','developer'])` wrapper.
- **`LocaleContext`** (new) holds `locale` (`en` | `mr`), persisted to localStorage; provides `t(key)` and `tx(field, value)` helpers.
- **`ApprovalContext` / hooks** for change-request status badges.
- **`components/` additions:** `NavDrawer` (mobile), `ResponsiveTable` (stacked-card mode under `sm`), `ApprovalBadge`, `TranslationField`, `LanguageSwitch`, `ChangeRequestPanel`.
- **`services/`** gain `user.service.js`, `approval.service.js`, `transaction.service.js`, `translation.service.js`, `finance.service.js`.
- Per-domain services gain an `includePending` option (Partner views) — Admin calls omit it.

**Routing:** Keep current route tree; add `/finance`, `/approvals`, `/users`, `/settings`, `/audit`. Guard by role.

---

## 2. Backend Architecture (proposed)

**Stack (unchanged):** Node + Express + Mongoose 8 + JWT + helmet + cors.

Proposed structural changes (additive):

- **`middleware/authorize.js`** (new): `requireRole(...roles)` and `requirePermission(...perms)`. Replaces the bare `authenticate` on every route with `authenticate` + `authorize`.
- **`middleware/approvalGate.js`** (new): ensures pending data is excluded from Admin/readonly reads.
- **`models/`** gain: `User`, `ChangeRequest`, `Approval`, `Transaction`, `AuditLog`, `Translation`. `Partner` stays (business entity) and gains `userId` link.
- **`services/approval.service.js`** (new): create/approve/reject/commit logic + required-approver computation.
- **`services/transaction.service.js`** (new): ledger write-through + queries.
- **`services/user.service.js`** (new): developer-managed user lifecycle.
- **`services/translation.service.js`** (new): get/set translations.
- Existing per-domain services (customer/plot/payment/expense/income/capital/loan) gain an **approval-aware wrapper**: Partner mutations are routed through `ChangeRequest` creation; Developer/Admin(NA) mutations apply directly.

**Route layering (new convention):**

```
authenticate → authorize(role) → [approvalGate if needed] → controller → service
```

---

## 3. Authentication (proposed)

- Single login endpoint `/api/auth/login` accepts username + password, returns JWT.
- JWT payload (extended):
  ```json
  { "sub": "<userId>", "role": "developer|partner|admin", "pid": "<partnerId|null>" }
  ```
- `authenticate` resolves the user from `User` collection (replacing the V1 `Admin`-only lookup).
- `authenticate` rejects inactive users (`active: false`) for all roles.

---

## 4. Authorization (proposed)

- Every protected route uses `authorize(...)`.
- Admin gets **only GET** routes; any mutating route returns `403 Forbidden` if role=admin.
- Developer bypasses approval (server-side) — change requests are optional for developer; direct commit allowed.
- Partner mutating routes create a `ChangeRequest`; the actual entity is untouched until commit.

---

## 5. Database Architecture (proposed)

See `C-database-design.md` for full schema diff. Summary:

- New collections: `users`, `changerequests`, `approvals`, `transactions`, `auditlogs`, `translations`.
- `partners` collection gains `userId` (link to login identity) — backfilled in migration.
- Source financial collections unchanged (system of record). `transactions` is additive.

---

## 6. Finance Architecture (proposed) — see also `G-finance-flow.md`

**AD-3 (Finance centralization).**

- **Options considered**
  - (a) New `Transaction` ledger written-through from each source module.
  - (b) Pure aggregation view (no stored ledger).
  - (c) Make `Transaction` the only system of record; rewrite source modules.
- **Selected:** (a) additive `Transaction` collection with write-through from source services.
- **Reason:** Lowest risk to V1; preserves per-module pages & rich fields; gives a unified
  "All Transactions" ledger and clean Money In/Out filtering.
- **Tradeoffs:** Slight duplication (source + ledger). Mitigated by generating the
  `Transaction` inside the same service functions and a one-time backfill script for history.

`Transaction` shape (proposed):
```js
{
  direction: 'in' | 'out',
  amount: Decimal128,
  date: Date,
  categoryId: ObjectId | null,
  sourceType: 'payment'|'income'|'expense'|'capital'|'loan',
  sourceId: ObjectId,
  customerId: ObjectId | null,
  partnerId: ObjectId | null,
  plotId: ObjectId | null,
  method: String,
  reference: String,
  description: String,
  notes: String,
  createdBy: ObjectId,
  createdAt, updatedAt
}
```

---

## 7. Change Request Architecture (proposed) — see also `F-partner-approval-flow.md`

**AD-2 (approval model).**

- **Options considered**
  - (a) Keep official entity unchanged until commit; store proposed delta in `ChangeRequest`; apply on commit.
  - (b) Write pending overlay into the entity and filter on read.
- **Selected:** (a) official data untouched until commit.
- **Reason:** Strongest Admin-isolation guarantee (pending never persists in official docs);
  simpler read paths; aligns with "Admins see official data" rule.
- **Tradeoffs:** For `create`/`delete` operations, entity does not exist/is not removed until
  commit. Handled by storing the full proposed payload in the `ChangeRequest` and applying on commit.

`ChangeRequest` shape (proposed):
```js
{
  entityType: 'customer'|'plot'|'payment'|'expense'|'income'|'partner'|'capital'|'loan'|'category',
  entityId: ObjectId | null,        // null for create
  operation: 'create'|'update'|'delete',
  requestedBy: ObjectId,             // User (partner) id
  requestedAt: Date,
  status: 'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED'|'COMMITTED',
  changes: [ { field, oldValue, newValue } ],
  approvals: [ { partnerId, action:'approve'|'reject', at, note } ],
  rejectionReason: String | null,
  committedAt: Date | null,
  committedBy: ObjectId | null,
  requiredApprovers: [ObjectId],     // snapshot for audit
  createdAt, updatedAt
}
```

Required approvers computed at **approval time** as:
```
requiredApprovers = activePartnerUserIds − requestedBy
```
(Developer never included — see Rule 5/6.)

---

## 8. Approval Architecture (proposed)

- Only `role: partner` users may call approve/reject (`authorize('partner')` + server-side partner check).
- A Partner cannot approve their own request (auto-counted).
- When `approvals.length === requiredApprovers.length` (all approve, none reject) → status `APPROVED` then auto-`COMMITTED`; service applies the delta to the official entity atomically (reuse existing `pick`/`update` logic in the relevant service).
- Any rejection → status `REJECTED`, change not applied; requester may create a new request (resubmit).
- Cancellation by requester → `CANCELLED`.
- Edge: if required approvers = 0 (e.g., only one active Partner, or requester is the sole partner) → auto-commit immediately.

---

## 9. Translation Architecture (proposed)

**AD-4 (translation storage).**

- **Options considered**
  - (a) Separate `Translation` collection keyed by (entityType, entityId, field, locale).
  - (b) Inline `translations` map on each entity (`name_mr`, `notesMr`, …).
- **Selected:** (a) separate `Translation` collection.
- **Reason:** Original text is never touched; translations are optional, overrideable,
  and queryable without bloating every schema; clean separation of concern.
- **Tradeoffs:** Extra collection + join for translated views. Mitigated by fetching
  translations lazily/per-entity and caching in UI.

Rules:
- Canonical value = original user entry (e.g., `Plot.location`, `Customer.name`, `notes`).
- `Translation` stores `{ entityType, entityId, field, locale:'mr', value }`.
- Exact fields (ids, amounts, dates, references, enums, methods) are **never** translated.
- Bidirectional assist: UI button "Translate ↔" calls an optional translation helper;
  result is written to `Translation`, user can edit; original preserved.
- Marathi Unicode supported end-to-end (UTF-8 throughout; existing `Intl` formatters stay en-IN for numbers).

---

## 10. Audit Architecture (proposed)

`AuditLog` collection (append-only) records, for every committed change:
```
{ actorId, actorRole, changeRequestId, entityType, entityId,
  operation, field, oldValue, newValue, at }
```
Plus the `ChangeRequest.approvals[]` array gives the full approval/rejection history.
Admins (read-only) and Developers can read audit logs; Partners see their own/related requests.

---

## 11. API Architecture (proposed) — see `D-api-plan.md`

- REST, consistent `{ success, message, data }` envelope (V1 pattern kept).
- Grouping: `/auth`, `/users`, `/customers`, `/plots`, `/payments`, `/expenses`,
  `/income`, `/categories`, `/partners`, `/capital`, `/loans`, `/finance`,
  `/approvals`, `/audit`, `/dashboard`, `/reports`.
- All mutating Partner routes internally create a `ChangeRequest` (unless Developer).
- Admin routes are GET-only at the server.

---

## 12. Data Flow (proposed)

### Partner proposes a change
```
Partner UI → POST /api/plots/:id  (authorize partner)
  → service detects partner + shared data
  → creates ChangeRequest (PENDING), does NOT mutate Plot
  → returns 202 with changeRequestId
Partner/other Partners → GET /api/approvals (pending for them)
  → approve/reject
  → when all required approve → commit
  → service applies delta to Plot (atomic)
  → AuditLog written
Admin → GET /api/plots → sees ORIGINAL Plot (pending hidden at service layer)
```

### Developer change
```
Developer UI → POST /api/plots/:id (authorize developer)
  → service applies directly (no ChangeRequest)
  → AuditLog written (actorRole: developer)
```

### Finance
```
Payment/Income/Expense/Capital/Loan create
  → source record written
  → Transaction write-through (ledger)
Finance UI → GET /api/finance/transactions?direction=in|out
  → unified ledger from transactions collection
```
