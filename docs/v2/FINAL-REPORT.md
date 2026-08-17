# Final Phase 0 Report — DS Properties V2

**Status: COMPLETE** (planning only; V1 codebase untouched)

---

## 1. Current V1 Reality (audited from code, not from docs)

### Backend (`server/src`)
- **Express + Mongoose 8 + JWT + helmet + cors.** Thin routes → controllers → services. Consistent `{success,message,data}` envelope; central `errorHandler`; `AppError`.
- **Auth:** Single `Admin` model; `authenticate` loads `Admin` only; JWT payload hardcodes `role:'admin'`. **No role/permission system.**
- **Users:** Only `Admin` has login. `Partner` is a **business entity with no credentials** (name/phone/email/status only).
- **Domains implemented (fully):** Customers, Plots, Payments, Expenses (soft-delete), Income, Categories, Partners, PartnerCapital, LoanReceived, Dashboard, Reports (CSV/Excel/PDF), Receipts (frontend aggregation of Capital+Loans).
- **Finance:** Separate collections — `payments` (customer plot installments, append-only, overpayment-rule enforced via MongoDB transaction), `incomes`, `expenses`, `partnercapitals`, `loanreceiveds`. **No central transaction ledger.** Receipts = Capital+Loans view only.
- **Money handling:** `Decimal128` everywhere; arithmetic via `decimal.js`. Outstanding derived from `price − Σ payments`. Operating Income Result = Income − Expenses (distinct from receivables).
- **No:** change requests, approvals, audit log, pending state, translations, i18n, roles beyond admin.

### Frontend (`client/src`)
- **React 18 + Vite + React Router 6 + Tailwind (DS color system) + axios + lucide-react.** `AuthContext` (admin only), `ToastContext`, per-domain `services/`, reusable `components/` (Card, Button, Badge, Field, FilterPanel, DeleteConfirmModal, Skeleton, Spinner, Toast, EmptyState, ErrorState).
- **Routing:** `RequireAuth` gates all app routes. Horizontal-scroll top nav (`AppLayout`).
- **No:** role UI, i18n, translation, dedicated mobile nav, responsive tables (uses `overflow-x-auto` tables), language switch.

### Documentation discrepancies (vs `PROJECT.md`)
- `PROJECT.md` says "fresh start, only Admin role, no Partners/Loans/Capital." **Reality:** Partners, Loans, Capital, Receipts, Reports all implemented.
- `PROJECT.md` status section marks everything "COMPLETE" and "models/README.md" says "Placeholder / Phase 1" while real models exist. **Stale/contradictory docs.**
- `PROJECT.md` Decision 004/012/020 assume single admin; V2 overrides with 3 roles (per confirmed requirements).

---

## 2. V2 Target Architecture (summary)

- **Unified `User` collection** (role: developer|partner|admin) replaces `Admin` as auth source; `Partner` gains `userId` link.
- **Authorization middleware** (`requireRole`/`requirePermission`) on every route; Admin is GET-only server-side.
- **ChangeRequest + AuditLog** collections; Partner mutations create a PENDING request that does **not** touch official data until all required Partners approve → commit.
- **Transaction** ledger (additive, write-through) powers central Finance (All / Money In / Money Out), sourced from existing modules.
- **Translation** stored separately (`Translation` collection); original text never overwritten.
- **LocaleContext + language switch**; responsive shell (nav drawer, stacked tables, adaptive forms/modals).

---

## 3. Major Changes Required & Why

| Change | Why |
|--------|-----|
| Unified `User` + 3 roles | Confirmed requirement; current auth is admin-only |
| `authorize` middleware + Admin read-only | Backend security mandate (Rule 3) |
| ChangeRequest/commit model | Partner approval workflow (Rule 4/5/6) |
| Pending isolation in reads | Admins must never see pending (Rule 4) |
| `Transaction` ledger | Central Finance requirement |
| `Translation` collection | Marathi without corrupting originals (Rule 8) |
| LocaleContext + responsive shell | EN/MR + multi-device requirements |
| Deprecate `admins` → migrate to `users` | Single auth path |

---

## 4. Architecture Decisions (AD)

- **AD-1 — Unified `User` model** (role + optional `partnerId`). Chosen over separate Admin/Partner/Developer collections for one auth path & simple permission checks. Tradeoff: Partner business record stays separate (capital/loans history).
- **AD-2 — Official data untouched until commit** (delta in ChangeRequest). Chosen over read-time overlay for strongest Admin isolation. Tradeoff: create/delete handled via stored payload.
- **AD-3 — Additive `Transaction` ledger (write-through)**. Chosen over rewriting source modules or pure aggregation. Tradeoff: minor duplication, mitigated by write-through + backfill.
- **AD-4 — Separate `Translation` collection**. Chosen over inline maps to keep originals pristine and translations optional/overrideable.
- **AD-5 — Responsive shell via Tailwind + new `NavDrawer`/`ResponsiveTable`** (no new framework). Lowest risk.
- **AD-6 — Backend `authorize` on every route**; Admin mutation → 403. Enforces Rule 3.

---

## 5. Risks

| Risk | Area | Mitigation |
|------|------|------------|
| Auth breakage during `admins`→`users` migration | Auth | Backup; staged migration; keep `admins` until verified |
| Partner approval bypass / Admin sees pending | Authz | Server-side required-approver calc; pending never written to source docs |
| Developer accidentally counted as approver | Approval | `approve` endpoint rejects non-partner; required set excludes developer |
| Finance ledger desync from sources | Finance | Write-through in same service fn; backfill script + reconciliation |
| Translation overwrites original | Translation | Separate collection; original field canonical |
| Broken mobile UX | Responsive | Dedicated responsive components; breakpoint testing |
| Stale docs cause wrong assumptions | Process | This audit treats code as source of truth; Phase 1 must re-verify |

---

## 6. Dependencies

- Phase 1 → Phase 0 docs + DB backup.
- Phase 2 → Phase 1 (roles) + Partner/User link.
- Phase 3 → Phase 1.
- Phase 4 → UI shell (Phases 1–2).
- Phase 5 → Phases 1–4 UI.
- Phase 6 → Phases 1–5.
- Phase 7 → Phase 6.

---

## 7. Phase 0 Status

**COMPLETE** — V1 audited; V2 architecture documented (A–I + this report); ready for Phase 1 implementation without guessing.

---

## 8. Final Output Required (prompt §19)

1. **Files created/updated:** `docs/v2/00-INDEX.md`, `A-requirements.md`, `B-architecture.md`, `C-database-design.md`, `D-api-plan.md`, `E-permission-matrix.md`, `F-partner-approval-flow.md`, `G-finance-flow.md`, `H-migration-strategy.md`, `I-implementation-roadmap.md`, `FINAL-REPORT.md`. (No V1 source modified.)
2. **Important V1 findings:** admin-only auth (no roles); `Partner` has no login; finance split across 5 collections with no ledger; Receipts = Capital+Loans UI only; no approval/audit/translation/i18n; horizontal-scroll nav; `PROJECT.md` stale/contradictory.
3. **Key V2 decisions:** unified `User` (3 roles); `authorize` middleware; ChangeRequest+commit (official untouched until approval); additive `Transaction` ledger; separate `Translation` collection; LocaleContext + responsive shell.
4. **Final user/permission model:** Developer (full, outside approval) / Partner (propose via ChangeRequest + approve others) / Admin (read-only, API-enforced). See `E-permission-matrix.md`.
5. **Final Partner approval workflow:** PENDING → (all active Partners − requester approve) → APPROVED → COMMITTED; reject needs reason; resubmit allowed; admin never sees pending; developer excluded. See `F-partner-approval-flow.md`.
6. **Final Finance architecture:** additive `Transaction` ledger written-through from Payment/Income/Expense/Capital/Loan; Money In/Out by `direction`; source modules unchanged; outstanding still derived. See `G-finance-flow.md`.
7. **Translation architecture:** canonical original field + separate `Translation` collection (entityType,entityId,field,locale,value); exact fields never translated; assist-only, editable, non-destructive. See `B-architecture.md` §9.
8. **Responsive architecture:** keep Tailwind; add `NavDrawer` (mobile), `ResponsiveTable` (stacked cards < sm), adaptive forms/modals/charts; test 320/768/1024/1440. See `B-architecture.md` §1 & `I` Phase 5.
9. **V2 roadmap:** Phases 0–7 as documented in `I-implementation-roadmap.md`.
10. **Risks & blockers:** listed in §5. No hard blockers; main risk is auth migration (mitigated by backup + staged rollout).
11. **Exact next task for Phase 1:** Implement unified `User` model + `authenticate` switch (Admin→User) + `authorize(role)` middleware + Developer seed + migrate `admins`→`users`, then role-aware `RequireAuth`/`AuthContext`. Begin with `docs/v2/C-database-design.md` §2.1 and `I-implementation-roadmap.md` Phase 1.
