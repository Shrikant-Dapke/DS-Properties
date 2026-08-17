# A. DS Properties V2 — Requirements Document

> Authoritative. Supersedes the single-role assumption in `PROJECT.md` for V2 scope.

## 1. Functional Requirements

### 1.1 User Categories (exactly three)

| Category | Nature | Login? | Approval involvement |
|----------|--------|--------|----------------------|
| **Developer** | System owner / super-user | Yes | **NONE** — outside Partner approval |
| **Partner** | Operational business user | Yes | Creates & approves/rejects change requests |
| **Admin** | Read-only stakeholder | Yes | None — view only |

- There are **no other roles**.
- A Partner login identity is linked to a `Partner` business record (capital/loans history).

### 1.2 Authentication & Authorization

- JWT-based login for all three categories.
- Passwords hashed (bcryptjs). Never stored in plaintext.
- Backend enforces role + permission on **every protected route** (not just UI hiding).
- Admin is strictly read-only at the API level.

### 1.3 Partner Change Approval (core V2 feature)

- Any Partner change to **shared business data** goes through a Change Request.
- Change is NOT applied to official data until all required Partners approve.
- Required approvers = `All Active Partners − Requesting Partner`.
- The requester's own request counts as their agreement automatically.
- Developer changes are applied immediately (no approval needed, never counted).
- Pending changes are **completely hidden from Admins** at the data-access layer.

### 1.4 Finance V2

- Central **Finance** area with:
  - **All Transactions** (unified ledger)
  - **Money In** (customer payments, partner capital, loans received, other income)
  - **Money Out** (road works, electricity, water, labor, legal, other expenses)
- Source modules (Customer→Plot→Payment, Partner→Capital, Loan, Expense) remain useful and feed the ledger.
- Existing V1 financial logic is preserved; architecture is centralized.

### 1.5 Audit Trail

- Every Partner change request is fully auditable: requester, entity, field, old/new value, timestamps, approvals, rejections, reasons, commit info.

### 1.6 English + Marathi

- App UI switchable between English and मराठी.
- Covers nav, dashboard, forms, buttons, tables, reports, notifications, validation, errors, settings.
- Correct Marathi Unicode support.

### 1.7 Bidirectional Translation (assistance)

- Original user-entered text preserved.
- Translation generated/stored separately, user-reviewable/editable.
- Translation errors never corrupt business data.

### 1.8 Responsive / Multi-Device

- Works properly on mobile, tablet, laptop, desktop.
- UX adapts (not just "fits"): nav, tables, forms, modals, charts, approval & finance workflows.

## 2. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Security | Backend-enforced authz; pending data never leaks to Admin APIs; secrets never exposed. |
| Data integrity | Monetary values via `Decimal128` + `decimal.js`; outstanding always derived (V1 rule preserved). |
| Auditability | Immutable-ish audit log of all Partner changes. |
| Performance | Indexes on frequent filters (phone, name, plotNumber, date, category, partnerId). |
| Reliability | Soft-delete for expenses preserved; payments append-only preserved. |
| Localization | Locale switch persisted per session/user; Marathi Unicode safe end-to-end. |
| Responsiveness | Single app adapts across breakpoints; no separate mobile build. |
| Tech stack | No new core frameworks (keep React/Vite/Express/Mongoose/JWT/Tailwind). |

## 3. Permission Model (summary; full matrix in `E-permission-matrix.md`)

- **Developer:** full CRUD, manage users/system, act outside approval.
- **Partner:** view + propose changes (create/edit/delete via change request) + approve/reject others' requests.
- **Admin:** view official/approved data only; no mutations; no approvals.

## 4. Approval Workflow Rules (summary; full in `F-partner-approval-flow.md`)

- Statuses: `PENDING → APPROVED → REJECTED → CANCELLED → COMMITTED`.
- Rejection requires a reason; requester may resubmit.
- Pending change does not mutate official data; commit applies changes atomically.
- If a Partner becomes inactive, their pending approvals are voided/recalculated.
- If membership changes while pending, required-approver set is recomputed at approval time.

## 5. Finance Rules (summary; full in `G-finance-flow.md`)

- Unified `Transaction` ledger (additive) fed by source modules.
- Money In / Money Out derived by `direction`.
- Outstanding (per plot) still derived from `Plot.price − Σ payments`.
- Operating Income Result = Other Income − Expenses (kept distinct from customer receivables).

## 6. Translation Rules (summary; full in `B-architecture.md` §Translation)

- Original field = canonical. Translations stored separately (`Translation` collection).
- Fields that are exact (IDs, amounts, dates, references) are **never** translated.
- Free-text fields (names, notes, descriptions) are translatable.
- Translation is assist-only; user can edit/override; never auto-overwrites original.

## 7. Responsive Rules (summary; full in `B-architecture.md` §Responsive)

- Collapsible nav drawer for small screens.
- Tables degrade to stacked cards on mobile.
- Forms stack; modals become full-screen sheets on mobile.
- Charts use responsive containers.

## 8. Audit Requirements

- `AuditLog` / change-request history must support: who, what, when, old→new, approvals, commit.
- Readable by Developer and Admin (read-only); Partners see requests they created or must approve.

## 9. Security Requirements

- JWT secret from env; never default in production.
- Helmet + CORS already present; keep.
- Role checks at route level; Admin mutation routes return 403.
- Pending data isolation enforced in services/queries, not just the frontend.
- Developer excluded from approval math server-side.
