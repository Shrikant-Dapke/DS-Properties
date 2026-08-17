# F. DS Properties V2 — Partner Approval Flow

This is the lifecycle of a Partner-initiated change to shared business data.

## 1. States

```
PENDING → APPROVED → COMMITTED
   │          │
   ├─→ REJECTED → (resubmit as new PENDING)
   └─→ CANCELLED
```

| State | Meaning |
|-------|---------|
| `PENDING` | Created, awaiting other Partner approvals. Official data untouched. |
| `APPROVED` | All required Partners approved; commit triggered. |
| `COMMITTED` | Delta applied to official entity; `committedAt`/`committedBy` set; `AuditLog` written. |
| `REJECTED` | At least one rejection with reason; change not applied. |
| `CANCELLED` | Requester (or Developer) cancelled before resolution. |

## 2. Who can do what

| Action | Allowed by |
|--------|-----------|
| Create request | Partner (on any shared business entity) |
| Approve | Other **active** Partners only (not requester, not Developer, not Admin) |
| Reject | Other **active** Partners only (requires `reason`) |
| Cancel | Requester, or Developer |
| Resubmit | Requester (after REJECTED) |
| Commit (auto) | System, when approvals == requiredApprovers |
| Force-commit | Developer (optional, out-of-band) |

## 3. Required approvers (exact rule)

```
requiredApprovers = getAllActivePartnerUserIds() − requestedBy
```

- Developer is **never** in this set (Rule 5/6).
- Admin is **never** in this set.
- Computed at **approval time** (not snapshotted blindly) so late membership changes are handled, but the request stores a `requiredApprovers` snapshot for audit.
- If `requiredApprovers` is empty → request auto-commits immediately (e.g., sole active Partner, or requester is the only partner).

## 4. Happy path

```
1. Partner A edits Plot price 5,00,000 → 5,50,000
2. Backend creates ChangeRequest (PENDING), stores changes[], does NOT touch Plot
3. Partner B, Partner C see it in /api/approvals
4. B approves → approvals=[B]
5. C approves → approvals=[B,C] == requiredApprovers
6. Status → APPROVED → COMMITTED
7. Plot.price updated to 5,50,000 (atomic)
8. AuditLog: A proposed, B approved, C approved, system committed
9. Admin now sees 5,50,000 (previously saw 5,00,000)
```

## 5. Rejection path

```
1. Partner A proposes change
2. Partner B rejects with reason "verify price with owner"
3. Status → REJECTED; change NOT applied
4. Partner A may create a new ChangeRequest (resubmit) with corrected values
```
- Rejection reason is **required** (validated server-side).
- A rejected request cannot be approved later; a new request is needed.

## 6. Cancellation

- Requester (or Developer) may cancel while PENDING → `CANCELLED`.
- No effect on official data.

## 7. Edge cases

| Scenario | Behavior |
|----------|----------|
| Requester becomes inactive | Request can be cancelled by Developer; or remaining active Partners still resolve it. Requester's auto-count stands. |
| An approval Partner becomes inactive after approving | Their approval remains valid for that request (snapshot). Future requests use current active set. Optionally void & re-request — **decision: keep approval valid (less churn)**. |
| Membership changes while PENDING | New active Partners are added to required set computed at next approval; existing approvals still count. |
| Concurrent edits to same entity | Serialize via request creation order; latest committed wins; a pending request's `oldValue` may be stale → on commit, re-validate against current official value (optimistic check) and reject commit if conflict. |
| Developer edit | No ChangeRequest; immediate commit + AuditLog(`actorRole:developer`). |

## 8. Admin visibility guarantee

- Admin `GET` on any business entity reads the **official** document only.
- `ChangeRequest` collection is not exposed to Admin via API.
- Dashboard/reports/finance summaries use official documents → pending never leaks.
