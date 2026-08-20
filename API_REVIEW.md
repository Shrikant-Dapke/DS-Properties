# API_REVIEW

Post-implementation self-review of the HTTP API against the master spec. Verified by the
integration suite (65 tests) and a live end-to-end smoke run.

## Coverage vs. spec

| Spec requirement | Status | Notes |
|---|---|---|
| Admin login/logout, JWT sessions, logout-all-devices | ✅ | `/auth/*`; refresh family chain; `logoutAll` on password change |
| Lockout after failed attempts | ✅ | 5 failures → lock ~15 min |
| Customers: add/edit/delete/list/search | ✅ | delete = soft (hard delete not exposed) |
| Partner capital / partner loan tracking | ✅ | `transactions.source_type` |
| Categories: add/edit/delete/list | ✅ | admin-only mutation, public read |
| Entries: add/edit/list/filter, payment mode | ✅ | filter by type/source/date-range/search |
| Reversal / cancel of entries | ✅ | admin + password; ledger-correct |
| Dashboard: opening balance, current balance, total intakes, outtakes, FY intake/outtake/net | ✅ | `/dashboard/summary?from&to`; adds period-scoped stats + recent entries |
| Monthly report (intakes/outtakes/categories/top customers) | ✅ | `/reports/monthly?year&month` or `?from&to` |
| Daily report | ✅ | `/reports/daily?from&to` |
| Date-range category report | ✅ | `/reports/categories?from&to` |
| Partner financial report (capital, loans, transfers, net) | ✅ | `/reports/partners/:publicId?from&to` (optional range; all-time default) |
| Recent entries on dashboard | ✅ | `recentTransactions` in summary |
| Customer / partner ledger | ✅ | `/customers/:id/ledger`, `/partners/:id/ledger` |
| Export data (PDF/Excel) | ✅ | frontend buttons per report tab; backend data via report endpoints |
| Audit log with actor/IP/UA/before/after | ✅ | `/audit` (admin) |
| Notifications for new entries | ✅ | duplicate warning on create |
| App settings (update) | ✅ | `/settings/:key` (admin) |
| Users: add/block/reset password | ✅ | `/users` (admin) |

## Conventions

- Base path `/api/v1`; JSON; camelCase request/response bodies.
- Success envelope: `{ success: true, data }`; list `data = { rows, pagination }`.
- Errors: `{ success: false, error: { code, message, details? } }` with correct HTTP
  status (400/401/403/404/409/429/500).
- Auth: `Authorization: Bearer <accessToken>` except `/auth/*`.
- IDs are `public_id` UUIDs exposed as `publicId`; internal `id` never leaves the API.
- Money returned as numeric strings (e.g. `"15000.00"`) to avoid float loss; frontend
  formats with INR grouping.

## Endpoints

```
POST  /auth/login | /auth/refresh | /auth/logout | /auth/change-password
GET   /dashboard/summary?from&to, /dashboard/categories?from&to
GET/POST/DELETE        /customers            (GET /:id, /:id/ledger)
GET/POST/DELETE        /partners             (GET /:id, /:id/ledger)
GET/POST               /categories           (GET /active, /:id; PATCH /:id; DELETE /:id)
GET/POST/DELETE        /transactions         (GET /:id; PATCH /:id; POST /:id/reverse; list accepts ?from&to)
GET   /reports/daily?from&to | /reports/monthly?year&month|?from&to | /reports/categories?from&to | /reports/partners/:publicId?from&to
GET/PATCH /settings    (GET /:key; PATCH /:key)
GET/POST /users        (GET /:id; PATCH /:id; POST /:id/activate, /:id/deactivate, /:id/reset-password; DELETE /:id)
GET   /audit?page&limit&action&userId&from&to
GET   /health
```

## Gaps / notes

1. **Hard delete is deliberately not exposed** for financial records; `DELETE` routes
   soft-delete and are admin+password gated.
2. **`PATCH /transactions/:id`** accepts partial updates; classification fields follow the
   same rules as create (an outtake being edited must not receive `sourceType`/customer/
   partner). Updating only, say, the amount of an outtake keeps its category — send the
   full classification only if you are changing it. Editing a reversed/reversal record
   returns 409.
2. **Reports are consistent with entries list**: all use the same "active, not reversed"
   aggregation, so dashboard, reports, and ledgers always agree (verified numerically).
2. **Date-range filtering**: any list endpoint accepts optional `from`/`to` (`YYYY-MM-DD`,
   inclusive) and may be single-sided; aggregate/report/dashboard endpoints require both
   sides or neither (rejecting `from > to` with a 400). The monthly report accepts
   `year`+`month` OR `from`+`to` (range wins when both are sent). Dashboard cache keys
   embed the range, so cached aggregates can never bleed across periods.
3. **Pagination default** `page=1&limit=20` (max 200). Ledger/dashboard fetch large sets
   via `limit` where the UI needs full client-side work. Partner report totals are
   computed server-side over the full ledger, independent of the page.
4. **Audit log is append-only**; no update/delete route exists.
5. A few spec edge behaviors were pinned down with the user during build (reversal as
   offset entry, duplicate as warning, no hard delete) — recorded in `DECISIONS.md`.
6. OpenAPI spec file not yet generated; endpoint list above is the current contract.