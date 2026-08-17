# D. DS Properties V2 — API Plan

Conventions (inherited from V1):
- REST, JSON. Envelope `{ success, message, data }` (success) / `{ success:false, message, errors? }` (fail).
- All routes require `authenticate` (JWT). Mutating/admin routes add `authorize(role)`.
- `R` = read, `C` = create, `U` = update, `D` = delete, `X` = special.

Legend for columns: **Auth** (login required), **Role**, **Permission**, **Approval behavior**.

---

## 1. Auth

| Method | Path | Auth | Role | Behavior |
|--------|------|------|------|----------|
| POST | `/api/auth/login` | No | — | Validate credentials → JWT (role in payload) |
| GET | `/api/auth/me` | Yes | any | Current user profile + role |
| POST | `/api/auth/logout` | Yes | any | Client-side token drop (server stateless) |

## 2. Users (Developer-managed)

| Method | Path | Role | Behavior |
|--------|------|------|----------|
| GET | `/api/users` | developer | List users |
| POST | `/api/users` | developer | Create user (role + optional partnerId) |
| GET | `/api/users/:id` | developer | User detail |
| PUT | `/api/users/:id` | developer | Edit user (role/active/password) |
| DELETE | `/api/users/:id` | developer | Deactivate/delete user |

## 3. Customers / Plots / Payments / Expenses / Income / Categories

Each group keeps V1 CRUD but with role + approval semantics:

| Method | Path (example `/api/plots`) | Role | Approval behavior |
|--------|------------------------------|------|-------------------|
| GET | `/` , `/:id` | developer, partner, admin | Admin/Partner see **official**; Partner `?pending=1` may include own pending |
| POST | `/` | developer, partner | **Partner** → creates `ChangeRequest` (PENDING), 202. **Developer** → direct commit. **Admin** → 403 |
| PUT | `/:id` | developer, partner | Partner → ChangeRequest; Developer → direct; Admin → 403 |
| DELETE | `/:id` | developer, partner | Partner → ChangeRequest(delete); Developer → direct; Admin → 403 |

- **Admin**: only GET routes registered; any C/U/D returns `403 Forbidden`.
- **Pending isolation**: GET for Admin never returns pending deltas (official only).

## 4. Partners & Capital & Loans

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/api/partners`, `/:id` | all | Official data |
| POST/PUT/DELETE | `/api/partners` | developer, partner (via ChangeRequest) | Admin 403 |
| GET | `/api/capital`, `/api/loans` | all (read) | Feeds Receipts + Finance(Money In) |
| POST/PUT | `/api/capital`, `/api/loans` | developer, partner (via ChangeRequest) | Admin 403; write-through to `transactions` |

## 5. Finance (NEW)

| Method | Path | Role | Behavior |
|--------|------|------|----------|
| GET | `/api/finance/transactions` | all (read) | Unified ledger; `?direction=in|out`, filters by date/customer/partner/plot/category |
| GET | `/api/finance/money-in` | all | `direction:'in'` view |
| GET | `/api/finance/money-out` | all | `direction:'out'` view |
| GET | `/api/finance/summary` | all | Totals, broken down by source type |

## 6. Approvals (NEW)

| Method | Path | Role | Behavior |
|--------|------|------|----------|
| GET | `/api/approvals` | partner, developer | Pending requests (partner: those they must/can approve + own) |
| GET | `/api/approvals/:id` | partner, developer | Request detail + changes + approvals |
| POST | `/api/approvals/:id/approve` | **partner only** | Records approval; if all required approve → commit |
| POST | `/api/approvals/:id/reject` | **partner only** | Requires `reason`; status REJECTED |
| POST | `/api/approvals/:id/cancel` | partner (requester) / developer | CANCELLED |
| POST | `/api/approvals/:id/resubmit` | partner (requester) | New request from rejected |

- **Developer** can view all; Developer approval is **never** recorded as a Partner approval.
- **Admin**: no access to `/api/approvals` (read-only business data only).

## 7. Audit (NEW)

| Method | Path | Role | Behavior |
|--------|------|------|----------|
| GET | `/api/audit` | developer, admin (read), partner (own/related) | Queryable audit log |

## 8. Dashboard / Reports

| Method | Path | Role | Behavior |
|--------|------|------|----------|
| GET | `/api/dashboard/*` | all (read) | Official-data summaries only (pending excluded) |
| GET | `/api/reports/*` | all (read) | Official-data reports only |

## 9. Health

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| GET | `/api/health` | No | Liveness (unchanged) |
