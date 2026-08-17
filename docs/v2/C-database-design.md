# C. DS Properties V2 — Database Design

Legend:
- **EXISTING V1** = present in the audited codebase today.
- **PROPOSED V2** = new or changed for V2 (Phase 0 only — not created yet).
- All monetary values remain `Decimal128`; arithmetic via `decimal.js`.

---

## 1. EXISTING V1 SCHEMA (verbatim from `server/src/models`)

| Collection | Key fields | Notes |
|------------|-----------|-------|
| `admins` | `username*, email, passwordHash, name, role:'admin'(enum), active, lastLoginAt` | Only auth model today. No Developer/Partner/Admin split. |
| `customers` | `name*, phone, email, address, notes` | Business entity. |
| `plots` | `plotNumber*(unique), area, areaUnit, location, price(Decimal128)*, status(enum), customerId(ref Customer, nullable), notes` | Outstanding derived. |
| `payments` | `customerId*(ref), plotId*(ref), amount(Decimal128)*, date*, method(enum), reference, notes` | Append-only; overpayment rule enforced. |
| `expenses` | `amount*, date*, categoryId*(ref Category), description, reference, notes, deleted(bool)` | Soft-delete. |
| `incomes` | `amount*, date*, categoryId*(ref Category), description, reference, notes` | |
| `categories` | `name*, type('expense'|'income')*, isSeed, active, notes, normalizedName*` | Unique per (type, normalizedName). |
| `partners` | `name*, phone, email, address, notes, status('Active'|'Inactive')` | Business entity; **no login**. |
| `partnercapitals` | `partnerId*(ref Partner), amount*, date*, method, reference, notes` | |
| `loanreceiveds` | `lender*, amount*, date*, method, reference, notes` | |
| *(no `users`, `changerequests`, `transactions`, `auditlogs`, `translations`)* | | |

Indexes already present: payment/plot/customer/partner by relevant fields; category unique compound; expense `deleted`.

---

## 2. PROPOSED V2 SCHEMA (additions / changes)

### 2.1 `users` (NEW — replaces `admins` as the auth collection)

```js
{
  username:   { type: String, required, unique, lowercase, trim },
  email:      { type: String, unique, sparse, lowercase, trim },
  passwordHash:{ type: String, required },
  name:       { type: String, trim },
  role:       { type: String, enum: ['developer','partner','admin'], required },
  partnerId:  { type: ObjectId, ref: 'Partner', default: null }, // set when role='partner'
  active:     { type: Boolean, default: true },
  lastLoginAt:{ type: Date, default: null },
  preferredLocale: { type: String, enum: ['en','mr'], default: 'en' },
  createdAt, updatedAt
}
```
- **Migration:** existing `admins` rows become `users` with `role:'admin'`. New Developer seeded via CLI.
- Auth `authenticate` switches from `Admin` → `User`.

### 2.2 `partners` (CHANGED)

Add: `userId: { type: ObjectId, ref: 'User', default: null, index: true }`
- Links the business Partner (capital/loans history) to its login identity.
- Existing Partners: `userId` backfilled to a newly created `User(role:'partner')` during migration (or left null if no login granted yet).

### 2.3 `changerequests` (NEW)

```js
{
  entityType: { type: String, enum: [...], required },
  entityId:   { type: ObjectId, default: null },     // null for create
  operation:  { type: String, enum: ['create','update','delete'], required },
  requestedBy:{ type: ObjectId, ref: 'User', required },
  requestedAt:{ type: Date, default: Date.now },
  status:     { type: String, enum: ['PENDING','APPROVED','REJECTED','CANCELLED','COMMITTED'], default: 'PENDING', index: true },
  changes:    [ { field: String, oldValue: Mixed, newValue: Mixed } ],
  approvals:  [ { partnerId: ObjectId, action: String, at: Date, note: String } ],
  rejectionReason: { type: String, default: null },
  requiredApprovers: [ { type: ObjectId, ref: 'User' } ],
  committedAt: { type: Date, default: null },
  committedBy:{ type: ObjectId, ref: 'User', default: null },
  createdAt, updatedAt
}
```
Indexes: `status`, `requestedBy`, `entityType+entityId`.

### 2.4 `approvals` (embedded in `changerequests.approvals`)

No separate collection required; the embedded array is sufficient and transactional with the request. (Documented as its own concept for clarity.)

### 2.5 `transactions` (NEW — Finance ledger)

```js
{
  direction:  { type: String, enum: ['in','out'], required },
  amount:     { type: Decimal128, required },
  date:       { type: Date, required, index: -1 },
  categoryId: { type: ObjectId, ref: 'Category', default: null },
  sourceType: { type: String, enum: ['payment','income','expense','capital','loan'], required },
  sourceId:   { type: ObjectId, required },
  customerId: { type: ObjectId, ref: 'Customer', default: null },
  partnerId:  { type: ObjectId, ref: 'Partner', default: null },
  plotId:     { type: ObjectId, ref: 'Plot', default: null },
  method:     { type: String },
  reference:  { type: String },
  description:{ type: String },
  notes:      { type: String },
  createdBy:  { type: ObjectId, ref: 'User' },
  createdAt, updatedAt
}
```
Indexes: `direction`, `date`, `sourceType`, `customerId`, `partnerId`, `plotId`, `categoryId`.

### 2.6 `auditlogs` (NEW)

```js
{
  actorId:    { type: ObjectId, ref: 'User', required },
  actorRole:  { type: String, enum: ['developer','partner','admin'], required },
  changeRequestId: { type: ObjectId, ref: 'ChangeRequest', default: null },
  entityType: { type: String, required },
  entityId:   { type: ObjectId, required },
  operation:  { type: String, enum: ['create','update','delete','approve','reject','commit','login'], required },
  field:      { type: String, default: null },
  oldValue:   { type: Mixed, default: null },
  newValue:   { type: Mixed, default: null },
  at:         { type: Date, default: Date.now, index: -1 }
}
```

### 2.7 `translations` (NEW)

```js
{
  entityType: { type: String, required },   // e.g. 'plot','customer','expense'
  entityId:   { type: ObjectId, required },
  field:      { type: String, required },    // e.g. 'location','notes','description'
  locale:     { type: String, enum: ['mr'], required },
  value:      { type: String, required },
  updatedBy:  { type: ObjectId, ref: 'User' },
  updatedAt:  { type: Date, default: Date.now }
}
```
Compound unique index: `(entityType, entityId, field, locale)`.

### 2.8 Existing source financial collections (`payments`, `incomes`, `expenses`, `partnercapitals`, `loanreceiveds`)

**Unchanged** — remain the system of record for their own CRUD and detail pages. They gain a write-through hook that also creates a `Transaction` (see `G-finance-flow.md`). No field changes required; optionally add `createdBy` for audit.

---

## 3. Schema Change Summary

| Collection | Change |
|------------|--------|
| `admins` | **Deprecated** → migrated into `users` |
| `users` | NEW |
| `partners` | + `userId` |
| `changerequests` | NEW |
| `transactions` | NEW |
| `auditlogs` | NEW |
| `translations` | NEW |
| `customers/plots/payments/incomes/expenses/categories/partnercapitals/loanreceiveds` | Unchanged (additive `createdBy` optional) |

No destructive schema change to V1 collections; all V2 collections are additive.
