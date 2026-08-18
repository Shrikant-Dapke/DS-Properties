# Phase 2 — Partner Approval & Audit System (Implementation Notes)

Status: **Implemented** (backend + integration tests + Partner/Developer UI).
Scope follows `F-partner-approval-flow.md`, `C-database-design.md`, `D-api-plan.md`,
`E-permission-matrix.md`, and `I-implementation-roadmap.md` for Phase 2.

## What was built

### Backend
- `server/src/models/ChangeRequest.js` — matches §C.2.3
  (`entityType`, `entityId`, `operation`, `requestedBy`, `status`,
  `changes[{field,oldValue,newValue}]`, `approvals[{partnerId,action,at,note}]`,
  `rejectionReason`, `requiredApprovers`, `committedAt`, `committedBy`).
- `server/src/models/AuditLog.js` — matches §C.2.6
  (`actorId`, `actorRole`, `changeRequestId`, `entityType`, `entityId`,
  `operation`, `field`, `oldValue`, `newValue`, `note`, `at`).
- `server/src/services/audit.service.js` — `writeAudit(entry)`.
- `server/src/services/changeRequest.service.js` — create / list / get / approve /
  reject / cancel / resubmit / commit with all §10 (security) rules enforced
  server-side.
- `server/src/controllers/changeRequest.controller.js` + two routers:
  - `/api/change-requests` (with `POST /` create)
  - `/api/approvals` (alias per §D.6, no create)
  - mounted in `server/src/app.js`.

### Frontend
- `client/src/services/changeRequest.service.js`
- `client/src/pages/ApprovalsPage.jsx` — list + create modal (generic, any entity)
- `client/src/pages/ApprovalDetailPage.jsx` — old→new diff, approvals, actions
- Routes `/approvals` and `/approvals/:id` in `App.jsx`
- Nav link "Approvals" shown only to `partner` / `developer` in `AppLayout.jsx`

## Approval rule (verbatim from the flow)
`requiredApprovers = active partner User IDs − requestedBy`. The requester is
auto-counted. A change request commits when **all** required approvers have
approved. If there are no other active partners, the request auto-commits on
creation. Approvers are recomputed at approval time, so membership changes are
handled (new partner → not required for in-flight requests; departed partner →
their approval no longer satisfies the set, but an existing approval stands).

## Security guarantees (server-enforced, not just UI)
- **Developer**: outside the workflow. Cannot create or approve/reject. Can
  view requests and cancel a pending request.
- **Partner**: creates requests; approves/rejects only if an eligible required
  approver and never their own request; requester can cancel and resubmit.
- **Admin**: `403` on every `/api/change-requests` and `/api/approvals`
  endpoint. Pending values are never written to official records, so Admin
  (who reads the real entities) is inherently isolated from pending data —
  no "pending" property exists on official models.
- Commit runs in a MongoDB transaction. Update commits use an optimistic
  concurrency check: if the official value changed since the request was
  created, commit is rejected with `409`.
- Identity is taken from the verified token (`auth.js`), never the client.

## Deliberate deviation from the plan
The plan (§D.3) described wiring every **entity** PUT/POST to emit a change
request. To limit risk and V1 regression, Phase 2 instead uses a **dedicated
creation endpoint** `POST /api/change-requests` (generic, entity-agnostic).
- Entity endpoints (`/api/plots`, etc.) remain Developer-only and untouched →
  V1 developer workflows keep working with no behavior change.
- Only Partners submit shared-data changes, which must clear approval before
  they affect official records.
- This keeps the change-request mechanism as the single, auditable path for
  partner-driven mutations, matching the "build the approval mechanism"
  intent while minimizing blast radius.

## Supported entities
Generic pipeline supports: `Plot, Customer, Partner, Category, Expense, Income,
Payment, PartnerCapital, LoanReceived`. Money fields (`Decimal128`) are
stringified for storage/display and re-cast on commit.

## Limitations (documented, not blocked)
- **Generic create/update**: the create modal sends raw `{field, newValue}`
  pairs. It does not enforce per-entity required/unique constraints beyond
  Mongoose validation at commit time (e.g. a Plot create without `plotNumber`
  fails at commit with a `400`/validation error surfaced to the user).
- **Delete via change request** deletes the official record on commit with no
  cascade guards (e.g. deleting a Customer with linked payments). Domain
  cascades are out of scope for the generic commit; partners should request
  such deletions with care.
- **Audit `cancel`/resubmit events** are not written to `AuditLog` (those
  operations are not in the §C.2.6 enum). A rejected/committed/approved event
  is always recorded.
- **No email/notification** on pending requests.

## Tests
`server/tests/phase2.test.js` (run `node --test tests/phase2.test.js`) covers:
two-partner E2E approval + commit, rejection keeps data intact, self-approve
blocked, admin isolation (403), developer exclusion but view+cancel allowed,
duplicate approval rejected, sole-active-partner auto-commit, inactive partner
blocked, and rejected→resubmit. All pass against a throwaway replica-set DB.
