# Phase 1 — Implementation Notes (Authentication & User Roles)

> Supplement to the Phase 0 docs. Records what was actually implemented in Phase 1
> and the authorization decisions made. Phase 0 docs (C, E, I) remain authoritative
> for the overall design; this note captures Phase 1 specifics.

## What was implemented

- **Unified `User` model** (`server/src/models/User.js`) with `role` enum
  `['developer','partner','admin']`, `partnerId` link, `preferredLocale`, `active`.
  Replaces the V1 `Admin`-only auth source. `Admin.js` model removed.
- **`Partner.userId`** link field added to `Partner` model.
- **`authenticate` middleware** now loads `User` (not `Admin`); exposes
  `req.user`, `req.userId`, `req.role` from the backend-loaded record.
- **`authorize(...roles)` middleware** (`server/src/middleware/authorize.js`) +
  role constants (`server/src/middleware/roles.js`).
- **JWT payload** now `{ sub, role, pid? }` (pid only for partners).
- **`auth.service` / `auth.controller`** use `User`; login response key renamed
  `admin` → `user`.
- **All business route files** gained `authorize(...)` after `authenticate`:
  - GET routes → `authorize(...ALL_ROLES)` (developer, partner, admin).
  - Mutation routes (POST/PUT/DELETE) → `authorize(...WRITE_ROLES)`.
- **Scripts:** `seedDeveloper.js`, `migrateAdminsToUsers.js`, `seedPartnerUsers.js`.
  `seedAdmin.js` removed; `package.json` scripts updated.
- **Frontend:** `AuthContext` role-aware (`role`, `isDeveloper/isPartner/isAdmin`,
  `id`); `RequireAuth` accepts `roles` prop; minor UI text ("Sign In", role label).

## Authorization decision (Phase 1)

Per the V2 permission matrix (E-permission-matrix.md), Admin is read-only and
Developer has full access. Partner write operations require the Change Request
workflow, which is **Phase 2** (not built here). Therefore in Phase 1:

```
ALL_ROLES   = ['developer','partner','admin']   // read
WRITE_ROLES = ['developer']                       // write (Phase 1)
```

- Mutations are allowed **only for Developer** in Phase 1.
- Admin gets `403` on any mutation (read-only enforced server-side).
- Partner gets `403` on mutations until Phase 2 enables Change Requests.
- This is consistent with "Admin must not receive write permissions" and
  "Developer is outside Partner approval." It does NOT grant Partner direct
  write access prematurely.

This is the intended V2 behavior; the migrated V1 `admin` account becomes a
read-only viewer, and the newly-seeded **Developer** is the operational user
until Partners come online in Phase 2.

## Migration result

- 1 existing Admin migrated → `User(role:'admin')`, password hash preserved.
- `admins` collection preserved as archive (not deleted).
- Developer seeded (idempotent).
- 2 Partners linked to `User(role:'partner')` via `Partner.userId`
  (opt-in `seed:partner-users`, `CREATE_PARTNER_USERS=true`).
- Migration and seed scripts are idempotent (re-run safe; skips existing).

## Known issue (documented, not fixed)

- **Duplicate `lender` index warning** from `LoanReceived.js` (field `index:true`
  + `schema.index({lender:1})). Pre-existing V1 issue, unrelated to Phase 1
  (Phase 1 did not touch `LoanReceived`). Left unchanged per scope rules.
  Harmless (Mongoose de-duplicates); recommend fixing in a later maintenance pass
  by removing one of the two declarations.

## Tests (all passing)

39/39 automated API checks passed: valid logins per role, invalid/unknown
credentials, missing/invalid JWT, `/auth/me`, GET allowed for all roles,
mutation allowed only for Developer (Admin & Partner → 403, anon → 401), and
V1 read regression across all business endpoints + reports.
