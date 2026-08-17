# DS Properties V2 — Phase 0 Documentation Index

> **Status:** Phase 0 — Planning & Architecture (PLANNING ONLY — no implementation)
> **Source of truth for V1:** actual codebase under `server/src` and `client/src`
> (audited, not assumed from `PROJECT.md`; see §Discrepancies in FINAL-REPORT.md)
> **Date:** 2026-08-17

These documents are the implementation-ready blueprint for DS Properties V2. They are
deliverables **A–I** plus the Final Report, as required by the Phase 0 brief.

| File | Deliverable | Contents |
|------|-------------|----------|
| `00-INDEX.md` | — | This index |
| `A-requirements.md` | A. V2 Requirements | Functional / non-functional / user categories / permissions / approval / finance / translation / responsive / audit / security |
| `B-architecture.md` | B. V2 Architecture | Frontend, backend, auth, authz, DB, finance, change-request, approval, translation, audit, API, data-flow |
| `C-database-design.md` | C. V2 Database Design | EXISTING V1 schema vs PROPOSED V2 schema (diff), new/changed collections |
| `D-api-plan.md` | D. V2 API Plan | Per-group endpoints, methods, auth, role, permission, approval behavior |
| `E-permission-matrix.md` | E. V2 Permission Matrix | Developer / Partner / Admin capability matrix |
| `F-partner-approval-flow.md` | F. Partner Approval Flow | Full change-request lifecycle |
| `G-finance-flow.md` | G. Finance Flow | Money In / Money Out / All Transactions and source relationships |
| `H-migration-strategy.md` | H. Migration Strategy | V1 → V2 data transition, backup/recovery |
| `I-implementation-roadmap.md` | I. V2 Roadmap | Per-phase tasks, dependencies, deliverables, testing, completion criteria |
| `FINAL-REPORT.md` | Final Phase 0 Report | V1 reality, target architecture, changes, decisions, risks, dependencies, status |

## How to read these docs

- **"EXISTING V1"** = what is actually in the codebase today.
- **"PROPOSED V2"** = what this blueprint recommends. Nothing here is implemented in Phase 0.
- Architecture decisions follow the **Rule 10 / AD-x** convention: Options considered → Selected → Reason → Tradeoffs.

## Critical Phase 0 rules (must not be violated by any later phase without re-planning)

1. Phase 0 is planning only — no V2 code in this phase.
2. Do not break V1.
3. Backend security is mandatory (never trust the UI).
4. Admins only ever see official/committed data.
5. Developer is outside the Partner approval workflow.
6. Only active Partners participate in Partner approval.
7. Preserve V1 data (safe migration only).
8. Preserve original user-entered text (translation never overwrites it).
9. Avoid unnecessary technology changes (stay on MERN + Mongoose + JWT + Tailwind + Vite).
10. Record architectural decisions.
