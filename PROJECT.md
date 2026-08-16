# DS Properties — Project Context & Development Guide

> **Purpose:** This file is the primary project context for OpenCode and future development.
> Treat it as the source of truth for the current DS Properties implementation.
>
> **Project root:** `D:\work\Projects\DS Properties`
>
> **Status:** Fresh start — no frontend, backend, or database implementation exists yet.

---

## 1. Project Identity

**Project Name:** DS Properties

DS Properties is a property/plotting business management system designed to help an administrator manage customers, plots, payments, expenses, income, and business reports from one application.

The system should prioritize **customers and plots** as core business entities. Financial tracking should connect naturally to those entities rather than behaving like a completely separate generic expense tracker.

### Primary objective

Build a reliable internal management system that makes it easy for the administrator to:

- Manage customers.
- Manage plots/properties.
- Track plot ownership/allocation.
- Track customer payments.
- Track outstanding amounts.
- Record business income.
- Record business expenses.
- Categorize expenses.
- View financial summaries and reports.
- Understand the current financial and property status from a dashboard.

### User model

The first version has only one role:

- **Admin**

Do not implement a multi-role permission system unless explicitly requested later.

---

# 2. Current Project Reality

The project is intentionally being restarted from scratch.

Current directory:

```text
D:\work\Projects\DS Properties
```

Current contents are effectively empty except for:

```text
.gitattributes
```

There is currently:

- No frontend.
- No backend.
- No MongoDB database/schema implementation.
- No authentication implementation.
- No API implementation.
- No existing UI implementation.

Do **not** assume that code from the previous DS Properties project exists in this directory.

Do **not** recreate old PostgreSQL architecture unless explicitly requested.

---

# 3. Technology Stack

## Frontend

Use:

- React
- Vite
- JavaScript unless TypeScript is explicitly chosen later
- React Router
- Tailwind CSS
- Axios
- Lucide React for icons

## Backend

Use:

- Node.js
- Express.js
- JavaScript
- Mongoose
- JWT authentication
- bcrypt/bcryptjs for password hashing

## Database

Use:

- MongoDB
- Local MongoDB instance during development

Default development connection uses the local single-node replica set `rs0` (required for MongoDB multi-document transactions used by the payments flow):

```text
mongodb://127.0.0.1:27017/ds_properties?replicaSet=rs0
```

The DS Properties dev MongoDB runs as replica set `rs0` on the standard MongoDB port `27017`. Use this URI in `server/.env` (see `server/.env.example`).

Do not introduce MongoDB Atlas unless explicitly requested.

## Development

Use:

- Git
- npm
- VS Code
- OpenCode

---

# 4. Architecture

Use a clear separation between frontend and backend.

Recommended initial structure:

```text
DS Properties/
│
├── PROJECT.md
├── README.md
├── .gitignore
├── .gitattributes
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── assets/
│   └── ...
│
└── server/
    ├── src/
    │   ├── config/
    │   ├── controllers/
    │   ├── middleware/
    │   ├── models/
    │   ├── routes/
    │   ├── services/
    │   ├── utils/
    │   └── server.js
    └── ...
```

Keep frontend and backend responsibilities separate.

The frontend must not directly access MongoDB.

The backend owns:

- Authentication.
- Validation.
- Business rules.
- Database access.
- Authorization.
- API responses.

---

# 5. Core Domain

The core of DS Properties is:

```text
Customer   1 ── N   Plot       (one customer owns many plots; a plot has at most one customer)
Plot       1 ── N   Payment    (a plot receives many payments)
Customer   1 ── N   Payment    (a payment always references both its customer and plot)
Category   1 ── N   Expense    (expenses are categorized)
Category   1 ── N   Income     (income is categorized)
```

There is **NO** direct Customer → Income relationship. Income references only `Category`.

Reports aggregate information from these entities.

---

# 6. Core Features

## 6.1 Dashboard

The dashboard should provide a concise overview of the business.

Potential metrics:

- Total customers.
- Total plots.
- Available plots.
- Allocated/sold plots.
- Total payments received.
- Total outstanding payments.
- Total income.
- Total expenses.
- Net balance.
- Recent payments.
- Recent expenses.
- Recent customer activity.

Do not overload the first dashboard implementation. Prioritize information that helps the administrator understand the current state quickly.

---

## 6.2 Customers

Customers are one of the two most important entities in the system.

The administrator should be able to:

- View customers.
- Add customers.
- Edit customers.
- View customer details.
- Search customers.
- Filter customers where useful.
- View associated plot information.
- View payment history.
- View outstanding amount.

A customer profile should eventually provide a consolidated view of:

```text
Customer
├── Personal/contact information
├── Associated plots
├── Payment history
├── Total paid
└── Outstanding amount
```

Avoid duplicating financial data unnecessarily.

---

## 6.3 Plots

Plots are a first-class entity and must not be treated as a minor field inside customers.

The administrator should be able to:

- View all plots.
- Add plots.
- Edit plots.
- View plot details.
- Search/filter plots.
- Track plot status.
- Associate a plot with a customer.
- View payment information for a plot.

Potential plot statuses:

```text
Available
Reserved
Allocated
Sold
```

Do not add complicated plot-status workflows until the actual business rules are confirmed.

Potential plot information:

```text
Plot Number
Area / Size
Location
Price
Status
Customer
Notes
Created At
Updated At
```

The exact fields can be refined before implementation.

---

# 7. Payment Tracking

Payment tracking is a major feature.

The system should allow the administrator to:

- Record a payment.
- Associate the payment with a customer.
- Associate the payment with a plot when applicable.
- Record payment amount.
- Record payment date.
- Record payment method.
- Add a reference/receipt number if needed.
- View payment history.
- Calculate total paid.
- Calculate outstanding amount.

Potential payment methods:

```text
Cash
UPI
Bank Transfer
Cheque
Other
```

Do not assume these are final business requirements if the user later specifies different methods.

### Important financial rule

Do not store a customer's outstanding balance as an arbitrary manually editable number if it can be derived.

Prefer:

```text
Outstanding (per plot) =
Plot.price
-
Σ(Payments where plotId = this plot)
```

`Plot.price` is the final negotiated price agreed with the customer (entered by the admin after offline negotiation). There is no separate agreement/negotiation-price field. See Decision 007.

Outstanding is always derived from `price` and recorded payments; it is never stored as an editable number.

If the business later requires adjustments, discounts, penalties, or manual balance corrections, model those explicitly rather than silently modifying totals.

---

# 8. Income

The system should support recording general business income that is not necessarily a customer plot payment.

Potential fields:

```text
Amount
Date
Category
Description
Reference
Notes
```

Plot/customer payments should remain distinguishable from generic income.

Do not merge all financial transactions into one model unless there is a clear architectural reason to do so.

---

# 9. Expenses

Expenses are another major feature.

The administrator should be able to:

- Record expenses.
- Edit expenses.
- Delete expenses where appropriate.
- Categorize expenses.
- Search/filter expenses.
- View expense history.
- Filter by date/category.
- Use expenses in reports.

Initial categories may include:

```text
Road Construction
Gutter Work
Electricity
Water
Labor
Legal
Other
```

These categories came from the previous DS Properties requirements and should be treated as initial seed data, not immutable business rules.

Allow the architecture to support adding/editing categories later.

---

# 10. Reports

Reports are a core requirement.

The system should eventually provide useful summaries such as:

### Financial

- Total income.
- Total expenses.
- Net balance.
- Payments received.
- Outstanding payments.

### Time-based

- Daily summary.
- Weekly summary.
- Monthly summary.
- Custom date range.

### Expense analysis

- Expenses by category.
- Expenses over time.
- Highest expense categories.

### Property/customer analysis

- Total plots.
- Available vs allocated/sold plots.
- Customer payment status.
- Outstanding balances.

Reports should be based on real database data.

Do not create fake/static report values after the initial UI prototype stage.

---

# 11. Authentication

There is only one user role:

```text
Admin
```

Authentication should use:

```text
JWT
+
bcrypt/bcryptjs
```

Minimum initial flow:

```text
Login
  ↓
Validate credentials
  ↓
Issue JWT
  ↓
Protected application routes
```

Passwords must never be stored in plaintext.

Do not add registration to the public frontend.

Admin creation can initially be handled through a secure seed/setup mechanism.

---

# 12. API Design

Use REST-style APIs.

Example structure:

```text
/api/auth
/api/customers
/api/plots
/api/payments
/api/income
/api/expenses
/api/categories
/api/reports
```

Use conventional HTTP methods:

```text
GET     Read
POST    Create
PUT/PATCH Update
DELETE  Delete
```

Use consistent JSON response structures.

Handle errors centrally.

Validate incoming request data before writing to MongoDB.

---

# 13. MongoDB / Mongoose Rules

Use Mongoose models.

Likely initial models:

```text
Admin
Customer
Plot
Payment
Income
Expense
Category
```

Relationships should use MongoDB references where appropriate.

Reference keys:

```text
Plot.customerId      → Customer._id      (nullable; null while Available)
Payment.customerId   → Customer._id      (required; must match Plot.customerId)
Payment.plotId       → Plot._id          (required)
Expense.categoryId   → Category._id      (required; Category.type = "expense")
Income.categoryId    → Category._id      (nullable; Category.type = "income")
```

Business rules enforced by the backend:

```text
- Payment.customerId MUST equal Plot.customerId for the supplied plotId.
- New payment must NOT exceed Plot.price (no overpayments in V1).
- Outstanding (per plot) = price − Σ(payments for that plot); derived, never stored.
- Operating Income Result = Income − Expenses; separate from customer payments / receivables.
```

Avoid unnecessary denormalization.

Do not duplicate customer names, plot numbers, or calculated financial totals throughout unrelated documents unless there is a deliberate performance requirement.

Use indexes for fields that are frequently searched or filtered.

Potential indexed fields:

```text
Customer phone
Customer name
Plot number
Payment date
Expense date
Expense category
```

Exact indexes should be decided during implementation based on actual query patterns.

---

# 14. UI / UX Direction

The uploaded visual reference is the **Folio Space Visual Identity System, Version 1.0**.

It should be treated as a **visual/design reference for DS Properties**, not as the business/content specification for DS Properties.

The reference establishes a strong editorial + modern product aesthetic. In particular, its visual system includes:

- Midnight Navy `#1A1A2E`
- Electric Indigo `#5B4FE9`
- Warm Orange `#FF6B35`
- Mint Confirmation `#00C9A7`
- Chalk `#F2EFEA`
- Soft Lavender `#A89FD6`

The guide assigns semantic roles to these colors. For DS Properties, preserve the overall visual discipline while adapting semantic usage to the property-management domain. fileciteturn0file0

### Typography reference

The guide uses:

```text
Display: DM Serif Display
Body: DM Sans
Utility / metadata: Space Mono
```

Use this combination or a very close implementation unless a later DS Properties design decision overrides it. The reference specifically uses DM Serif Display for editorial warmth, DM Sans for UI readability, and Space Mono for system/data metadata. fileciteturn0file0

### Spacing

Use a 4px base spacing system:

```text
4
8
12
16
24
32
48
64
80
```

The reference specifies a 1200px maximum desktop content width and a 12-column grid with 24px gutters. These are useful defaults for the DS Properties UI. fileciteturn0file0

### Icons

Prefer:

- Lucide
- Outline icons
- Consistent stroke weight

Do not mix filled and outline icon styles arbitrarily.

### Motion

Keep motion subtle and purposeful.

Reference timings:

```text
Micro interaction: 150ms
UI transition:     240ms
Page/screen:       360ms
```

Prefer ease-out for entering elements and ease-in-out for state transitions. Avoid excessive bounce/spring/elastic animation. fileciteturn0file0

---

# 15. DS Properties UI Principles

The Folio reference is visually sophisticated, but DS Properties is an **internal business management application**.

Therefore:

- Prioritize clarity over decoration.
- Prioritize data visibility.
- Keep tables readable.
- Make primary actions obvious.
- Make financial numbers easy to scan.
- Use cards where they improve hierarchy.
- Avoid unnecessary animations.
- Avoid excessive gradients.
- Avoid turning every component into a decorative element.
- Preserve the editorial typography and strong color system where appropriate.

The final UI should feel:

```text
Professional
Modern
Premium
Organized
Data-focused
Trustworthy
```

---

# 16. Coding Rules

## General

- Write readable code.
- Prefer small, focused components/functions.
- Avoid unnecessary abstraction.
- Do not duplicate business logic.
- Do not silently change unrelated files.
- Do not install libraries without a reason.
- Do not introduce a new architectural pattern without explaining why.

## Frontend

- Components should have clear responsibilities.
- Keep API calls in service modules rather than scattering Axios calls throughout components.
- Use reusable UI components.
- Keep business calculations out of presentation components where possible.
- Handle loading, empty, error, and success states.

## Backend

- Keep routes thin.
- Put request handling in controllers.
- Put reusable business logic in services when appropriate.
- Keep database operations inside the appropriate model/service layer.
- Validate input.
- Return useful HTTP status codes.
- Never expose sensitive credentials.

---

# 17. Error Handling

Every important data operation should account for:

```text
Loading
Success
Empty state
Validation error
Server error
Network error
Unauthorized access
```

User-facing errors should be understandable.

Do not expose raw stack traces or database errors to users.

---

# 18. Data Integrity

Financial data is sensitive to accidental modification.

Important rules:

- Never silently alter payment amounts.
- Never silently recalculate historical financial records in destructive ways.
- Preserve transaction dates.
- Validate positive monetary amounts.
- Use appropriate numeric types for monetary values.
- Avoid floating-point mistakes in financial calculations.
- Use explicit transaction/adjustment records if corrections are required.
- Confirm destructive actions where appropriate.

---

# 19. Development Workflow for OpenCode

OpenCode must follow this workflow.

### Step 1 — Understand

Before changing code:

- Inspect the relevant files.
- Understand the existing implementation.
- Check this `PROJECT.md`.
- Do not assume missing functionality exists.

### Step 2 — Plan

For non-trivial tasks:

- State what will change.
- Identify affected files.
- Identify database/API/UI implications.

### Step 3 — Implement

Make the smallest coherent change that solves the requested task.

### Step 4 — Verify

After implementation:

- Run the relevant build/test/lint command.
- Check for obvious runtime errors.
- Verify API/database behavior when applicable.

### Step 5 — Report

Tell the user:

- What changed.
- Which files changed.
- What was verified.
- Any remaining issue.

Do not claim something was tested if it was not actually tested.

---

# 20. OpenCode Rules

This project uses OpenCode as an AI coding agent.

OpenCode must:

1. Read `PROJECT.md` before making substantial changes.
2. Treat this file as project context, not as permission to make unrelated changes.
3. Inspect the existing code before modifying it.
4. Never fabricate files, APIs, database collections, or completed features.
5. Never claim a feature is complete without verifying the implementation.
6. Avoid large rewrites unless explicitly requested.
7. Ask for clarification when a business rule materially affects data integrity.
8. Preserve existing working functionality when adding features.
9. Keep dependencies minimal.
10. Follow the architecture defined in this document.
11. Update project documentation/status when a meaningful architectural or feature decision changes.
12. Never use the old PostgreSQL implementation as an assumption for this fresh project.
13. Never introduce MongoDB Atlas unless explicitly requested.
14. Never add additional user roles unless explicitly requested.

---

# 21. Git Rules

Use meaningful commits.

Examples:

```text
feat: add customer management
feat: add plot management
feat: add payment tracking
feat: add expense tracking
feat: add financial reports
fix: correct customer balance calculation
refactor: simplify payment service
```

Do not commit:

```text
.env
node_modules/
credentials
API keys
JWT secrets
local database dumps
```

---

# 22. Initial Development Phases

## Phase 0 — Project Setup

- Initialize repository structure.
- Initialize React/Vite frontend.
- Initialize Express backend.
- Configure MongoDB/Mongoose.
- Configure environment variables.
- Establish frontend/backend communication.
- Establish basic error handling.

## Phase 1 — Authentication

- Admin model.
- Password hashing.
- Login API.
- JWT authentication.
- Protected routes.
- Login UI.

## Phase 2 — Core Property Management

Prioritize:

1. Customers
2. Plots

Build:

- Customer CRUD.
- Plot CRUD.
- Customer ↔ plot association.
- Search/filter.
- Detail views.

## Phase 3 — Payments

Build:

- Payment model.
- Payment creation.
- Payment history.
- Customer payment summary.
- Plot payment summary.
- Outstanding calculations.

## Phase 4 — Financial Management

Build:

- Income.
- Expenses.
- Categories.
- Filters.
- Date ranges.
- Financial summaries.

## Phase 5 — Dashboard & Reports

Build:

- Dashboard metrics.
- Financial charts.
- Expense category analysis.
- Payment reports.
- Outstanding reports.
- Plot/customer summaries.
- Date-range reports.

## Phase 6 — Polish & Reliability

- Validation improvements.
- Error handling.
- Loading/empty states.
- Responsive UI.
- Accessibility improvements.
- Performance review.
- Security review.
- Production-readiness review.

---

# 23. Current Status

```text
Project reset:        COMPLETE
Project directory:    COMPLETE
Frontend:              COMPLETE
Backend:               COMPLETE
MongoDB:               COMPLETE
Authentication:       COMPLETE
Customers:             COMPLETE
Plots:                 COMPLETE
Payments:              COMPLETE
Categories:            COMPLETE
Income:                COMPLETE
Expenses:              COMPLETE
Reports:               COMPLETE
Dashboard:             COMPLETE
UI implementation:     COMPLETE
```

This is the baseline.

Do not report progress from the previous DS Properties project as progress in this new project.

---

# 24. Important Product Priority

When trade-offs are necessary, prioritize:

```text
1. Data correctness
2. Customers
3. Plots
4. Payments
5. Financial accuracy
6. Reports
7. Usability
8. Visual polish
9. Animation
```

A beautiful UI with incorrect payment/balance data is unacceptable.

---

# 25. Things OpenCode Must NOT Do

Do not:

- Reintroduce PostgreSQL.
- Assume the old DS Properties codebase exists.
- Add MongoDB Atlas automatically.
- Add unnecessary microservices.
- Add Redux unless a real need is demonstrated.
- Add multiple user roles without approval.
- Build a generic CRM instead of a property management system.
- Create fake report data in production features.
- Hardcode financial totals.
- Store plaintext passwords.
- Expose environment secrets.
- Make destructive database changes without confirmation.
- Rewrite the whole application to solve a small issue.
- Install large numbers of dependencies unnecessarily.
- Claim tests passed when they were not run.

---

# 26. Decision Log

### Decision 001 — Fresh Start

**Decision:** Restart DS Properties from an empty codebase.

**Reason:** The project is being resumed after a significant gap and the old implementation is no longer the starting point.

### Decision 002 — MERN-style stack

**Decision:** Use React + Node.js + Express + MongoDB/Mongoose.

**Reason:** The project is being restarted and MongoDB is preferred for the new implementation.

### Decision 003 — Local MongoDB

**Decision:** Use local MongoDB for development.

### Decision 004 — Admin-only

**Decision:** Initial product has one administrator role.

### Decision 005 — Customer and Plot priority

**Decision:** Customers and plots are the primary domain entities.

### Decision 006 — Visual reference

**Decision:** Use the uploaded Folio Space brand guide as a visual/design reference for the DS Properties interface, while adapting all content and business semantics to DS Properties. fileciteturn0file0

### Decision 007 — Amount due / outstanding

**Decision:** A plot has a single price field — `Plot.price`.
- `price` = the final negotiated/selling price agreed with the customer, entered by the admin after offline negotiation. **Required for every plot.**
- There is **no** separate `agreementAmount`, `agreementPrice`, or negotiation-price field. The original pre-negotiation price is not tracked.
- `customerId` on `Plot` is **nullable** (null while the plot is Available / unassigned). Outstanding is meaningful only for assigned plots (a plot with a customer).
- `Outstanding = price − Σ(payments associated with that plot)` for an assigned plot.

Outstanding is always derived; never stored as an editable number.

### Decision 008 — Customer / Plot cardinality

**Decision (V1):**
- One customer can own many plots.
- Each plot has at most one customer.
- A customer may exist with zero plots.
- Joint/multi-owner plots are NOT implemented in V1.

### Decision 009 — Category collection

**Decision:** Use a single `Category` collection with `type: "expense" | "income"`.
Do NOT create separate `ExpenseCategory` and `IncomeCategory` collections.
Expense records reference a category with `type: "expense"`; income records reference a category with `type: "income"`.

### Decision 010 — Payment linkage

**Decision (V1):** Every `Payment` must have both `customerId` and `plotId`.
Unallocated / customer-level-only payments are NOT implemented in V1.
A `Payment` always represents money paid toward a specific plot.

### Decision 011 — Payment vs Income boundary

**Decision:**
- Plot / customer installments → `Payment` records.
- Other business receipts (rent, commission, resale profit, etc.) → `Income` records.
- Do NOT merge `Payment` and `Income` into one financial category.
- Reports must keep these two concepts clearly distinguishable.

### Decision 012 — Admin creation

**Decision:** Use a CLI seed script for initial admin creation, e.g. `npm run seed:admin`.
Do NOT create a public `/setup` endpoint or public registration.

### Decision 013 — Monetary representation

**Decision:** Use MongoDB `Decimal128` for all monetary values.
Do NOT store calculated outstanding balances.
Always calculate balances from `price` and recorded payments.

### Decision 014 — Deletion / correction policy

**Decision:**
- Expenses use soft deletion (`deleted: true` flag), not hard delete.
- Payments must NOT have a normal destructive delete operation.
- Do NOT silently modify historical financial records.
- A future explicit correction / reversal mechanism may be added later if required.

### Decision 015 — Local MongoDB topology

**Decision:** Use local MongoDB configured as a single-node replica set (`--replSet`) so multi-document transaction support is available when genuinely required.
Do NOT add transaction logic everywhere unnecessarily.

### Decision 016 — Plot status workflow

**Decision:** Keep the initial status enum: `Available`, `Reserved`, `Allocated`, `Sold`.
Do NOT implement automatic status-transition rules yet.
Exact business rules for transitions will be defined when Plot management is implemented.

### Decision 017 — UI semantic color mapping

**Decision:** Adapt the Folio Space visual system to DS Properties with this semantic mapping:
- Electric Indigo `#5B4FE9` → primary actions, active navigation, interactive states.
- Mint `#00C9A7` → successful / paid / positive financial states.
- Warm Orange `#FF6B35` → important notifications, alerts, milestones.
- Midnight Navy `#1A1A2E` → authority, base, navigation.
- Chalk `#F2EFEA` → page / background / card surfaces.
- Soft Lavender `#A89FD6` → secondary / subtle accent.
Typography remains DM Serif Display (display), DM Sans (body/UI), Space Mono (labels/metadata/numbers).

### Decision 018 — Payment customer must match plot customer

**Decision:** Backend business rule — `Payment.customerId` MUST match `Plot.customerId` for the supplied `plotId`.
Reject (400/validation error) any payment where the supplied `customerId` does not belong to the supplied `plotId`.

### Decision 019 — V1 overpayment rule

**Decision:** A new payment must NOT cause `Σ(payments for a plot)` to exceed `Plot.price`.
Reject overpayments in V1.
Do NOT implement advance / unallocated / credit-balance payments yet.

### Decision 020 — Financial summary terminology

**Decision:**
- Rename "Net business balance" to **Operating Income Result**.
- `Operating Income Result = Other Income (Income) − Expenses`.
- Customer **Payments Received** and **Outstanding Receivables** are separate metrics and must NOT be silently combined with Operating Income Result.

---

# 27. First Implementation Target

Do not immediately build the entire application.

The first implementation target should be:

```text
Project setup
    ↓
MongoDB connection
    ↓
Express API
    ↓
React/Vite frontend
    ↓
Basic application shell
    ↓
Admin authentication
    ↓
Customer model + API + UI
    ↓
Plot model + API + UI
```

Only after this foundation is stable should payment tracking and reports be implemented.

---

# 28. Source of Truth

For the current project:

```text
PROJECT.md
+
Actual source code
+
Actual database behavior
```

are more authoritative than old project documentation or previous AI-generated assumptions.

When documentation conflicts with the codebase:

1. Inspect the code.
2. Verify actual behavior.
3. Determine the intended requirement with the user if necessary.
4. Update the documentation after the decision.

---

## Final instruction to OpenCode

You are working on **DS Properties**, a fresh-start property/plotting business management system.

Build it incrementally.

Prioritize **customers, plots, payment tracking, financial correctness, and reports**.

Use the defined MERN-style stack.

Follow the UI system described in this file.

Do not invent requirements.

Do not resurrect the old PostgreSQL architecture.

Do not make large architectural decisions without explaining them.

When uncertain about a business rule that affects stored financial/property data, stop and ask rather than guessing.

**Build the system carefully, verify every meaningful change, and keep the codebase understandable to a human developer.**
