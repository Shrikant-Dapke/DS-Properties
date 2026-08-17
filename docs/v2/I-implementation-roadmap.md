# I. DS Properties V2 — Implementation Roadmap

Each phase lists Tasks, Dependencies, Deliverables, Testing, Completion criteria.
Phase 0 is this document set. Phases 1–7 are future work (NOT done in Phase 0).

---

## Phase 0 — Planning & Architecture  ✅ (this deliverable)
- **Tasks:** Audit V1; design V2; document A–I + Final Report.
- **Dependencies:** None.
- **Deliverables:** docs/v2/* (requirements, architecture, DB, API, matrix, flows, migration, roadmap, final report).
- **Testing:** N/A (no code).
- **Completion:** All docs present and internally consistent; V1 left untouched.

## Phase 1 — Authentication & User Roles
- **Tasks:** Create `User` model (replace `Admin` auth); `authenticate`→`User`; `authorize` middleware; login/me endpoints; seed Developer; migrate `admins`→`users`; role-aware `RequireAuth`; `AuthContext` role + `can()`.
- **Dependencies:** Phase 0 docs; DB migration Step 0–2.
- **Deliverables:** Working 3-role auth; Developer/Partner/Admin can log in; Admin locked out of mutations server-side.
- **Testing:** Unit (authz middleware); integration (login per role; admin 403 on POST); migration verification.
- **Completion:** All three roles authenticate; permissions enforced at API; V1 admin data intact.

## Phase 2 — Partner Approval & Audit
- **Tasks:** `ChangeRequest` + `AuditLog` models; `approval.service`; approve/reject/cancel/resubmit endpoints; commit logic (reuse service `pick`/`update`); pending isolation in reads; audit writing; approval UI (list/detail/approve/reject); Admin sees official only.
- **Dependencies:** Phase 1 (roles), `Partner`→`User` link.
- **Deliverables:** End-to-end change-request flow; audit log; Admin isolation verified.
- **Testing:** Approval rule (required = active partners − requester); single-partner auto-commit; rejection reason required; admin never sees pending; developer excluded from approver set.
- **Completion:** Partner change requires approvals; official data updates only on commit; audit complete.

## Phase 3 — Finance V2
- **Tasks:** `Transaction` model; write-through in source services; backfill script; `/api/finance/*`; Finance UI (All/Money In/Money Out); keep V1 finance pages.
- **Dependencies:** Phase 1; source models stable.
- **Deliverables:** Unified ledger; finance views; historical backfill verified.
- **Testing:** Ledger totals reconcile with V1 dashboard; direction mapping correct; pending excluded.
- **Completion:** Finance central area works; V1 financial logic preserved.

## Phase 4 — English + Marathi
- **Tasks:** `LocaleContext` + `t()`; `Translation` model + service; language switch UI; translate-assist (optional helper, never overwrites original); apply `t()` across nav/dashboard/forms/tables/reports/errors; Marathi Unicode verification.
- **Dependencies:** UI shell (Phase 1/2).
- **Deliverables:** Language switch; translated UI; separate translation storage; original text preserved.
- **Testing:** Original vs translated separation; Unicode round-trip; exact fields not translated.
- **Completion:** App fully usable in EN and MR; originals intact.

## Phase 5 — Responsive / Multi-Device
- **Tasks:** `NavDrawer` (mobile); `ResponsiveTable` (stacked cards < sm); responsive forms/modals/charts; approval & finance workflows adapt; touch interactions.
- **Dependencies:** UI from Phases 1–4.
- **Deliverables:** Mobile/tablet/laptop/desktop layouts; no broken tables/modals.
- **Testing:** Manual on 320/768/1024/1440 breakpoints; touch targets; no horizontal scroll traps.
- **Completion:** All core flows usable on each device class.

## Phase 6 — Integration, Migration & Testing
- **Tasks:** Run full V1→V2 migration (H); regression, permission, security, approval, finance, translation, responsive, API, E2E tests; performance check.
- **Dependencies:** Phases 1–5.
- **Deliverables:** Green test suite; migration verified; rollback rehearsed.
- **Testing:** All categories above; bug-fix loop.
- **Completion:** Confidence to deploy.

## Phase 7 — Production Deployment
- **Tasks:** DB backup; production migration; env config (JWT secret, Mongo URI, client origin); deploy; smoke + owner acceptance testing; final fixes; V2 release.
- **Dependencies:** Phase 6 green.
- **Deliverables:** Live V2; acceptance sign-off.
- **Testing:** Smoke on prod; owner UAT.
- **Completion:** V2 released; V1 retired safely.

---

## Dependency summary (must-complete-before)

- Phase 1 needs Phase 0 + backup.
- Phase 2 needs Phase 1 (roles) + Partner/User link.
- Phase 3 needs Phase 1.
- Phase 4 needs UI shell (Phase 1/2).
- Phase 5 needs Phases 1–4 UI.
- Phase 6 needs Phases 1–5.
- Phase 7 needs Phase 6.
