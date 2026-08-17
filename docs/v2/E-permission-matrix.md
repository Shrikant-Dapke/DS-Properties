# E. DS Properties V2 — Permission Matrix

✓ = allowed · ✗ = denied (typically 403 at API) · (view) = read-only view

| Capability | Developer | Partner | Admin |
|------------|:---------:|:-------:|:-----:|
| **View official/approved data** | ✓ | ✓ | ✓ |
| **View pending change requests** | ✓ (all) | ✓ (own + others to approve) | ✗ |
| **Create business data** | ✓ (immediate) | ✓ (via ChangeRequest) | ✗ |
| **Edit business data** | ✓ (immediate) | ✓ (via ChangeRequest) | ✗ |
| **Delete business data** | ✓ (immediate) | ✓ (via ChangeRequest) | ✗ |
| **Approve Partner change** | ✗ (outside workflow) | ✓ (other Partners' requests) | ✗ |
| **Reject Partner change** | ✗ | ✓ | ✗ |
| **Self-approve own request** | n/a | ✗ (auto-counted) | ✗ |
| **Manage users** | ✓ | ✗ | ✗ |
| **Manage system / config** | ✓ | ✗ | ✗ |
| **View finance (Money In/Out, All Transactions)** | ✓ | ✓ | ✓ (read) |
| **Record finance entries** | ✓ | ✓ (via ChangeRequest) | ✗ |
| **View audit logs** | ✓ | ✓ (own/related) | ✓ (read) |
| **Access approvals UI/API** | ✓ (view) | ✓ | ✗ |
| **Language switch (EN/MR)** | ✓ | ✓ | ✓ |
| **Translation assistance** | ✓ | ✓ | ✓ (view) |

## Enforcement notes

- **Backend is authoritative.** Admin mutation routes return `403` regardless of UI.
- **Pending isolation:** Admin GET endpoints return official data only; `ChangeRequest`
  deltas are never applied to source collections until `COMMITTED`.
- **Developer exclusion:** `requiredApprovers = activePartnerUserIds − requestedBy`.
  Developer IDs are never added to that set, and `approve` endpoints reject non-partner roles.
- **Single active Partner edge:** required approvers = 0 → request auto-commits.

## Role definitions (recap)

- **Developer:** system owner; full CRUD; user/system management; acts outside approval.
- **Partner:** operational; proposes changes (create/edit/delete) via ChangeRequest;
  approves/rejects other Partners' requests; cannot self-approve.
- **Admin:** strictly read-only across all official data, finance, reports, audit.
