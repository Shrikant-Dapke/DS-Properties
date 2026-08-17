# G. DS Properties V2 — Finance Flow

V2 introduces a **central Finance** area without disturbing V1's working financial modules.

## 1. Source → Ledger model

```
Customer ─┐
Plot     ─┼─ Payment ─────────┐
Partner  ─┼─ Capital ─────────┤
Loan     ─┘                   ├─→ Transaction (ledger) ─→ Finance: All / Money In / Money Out
Income   ─────────────────────┤
Expense  ─────────────────────┘
```

Each source record, when created/committed, **write-through** creates a `Transaction`.

## 2. Transaction direction mapping

| Source | direction | Typical category |
|--------|-----------|------------------|
| Payment (customer plot installment) | `in` | (none — tied to plot/customer) |
| PartnerCapital | `in` | (partner funding) |
| LoanReceived | `in` | (borrowed funds) |
| Income | `in` | `Category(type:'income')` |
| Expense | `out` | `Category(type:'expense')` |

## 3. Finance views

- **All Transactions** = `transactions` collection, filterable by date/customer/partner/plot/category/sourceType.
- **Money In** = `transactions` where `direction:'in'`.
- **Money Out** = `transactions` where `direction:'out'`.

## 4. Relationships preserved

- `Transaction.customerId` ← Payment.customerId
- `Transaction.plotId` ← Payment.plotId
- `Transaction.partnerId` ← PartnerCapital.partnerId / Loan (lender is free text today; optionally link a Partner)
- `Transaction.categoryId` ← Income/Expense.categoryId
- `Transaction.sourceId` → original record (for drill-down to source module page)

## 5. Reporting & balances

- Outstanding (per plot) **still derived**: `Plot.price − Σ(payments for plot)`. Unchanged from V1.
- Operating Income Result = `Σ(income) − Σ(expense)` (excludes customer payments & receivables). Unchanged.
- Total Money Received = payments + partner capital + loans. Unchanged.
- All summaries read **official** data only (pending Partner changes excluded until committed).

## 6. Historical migration (additive)

- One-time script backfills `transactions` from existing `payments`, `incomes`,
  `expenses` (non-deleted), `partnercapitals`, `loanreceiveds`.
- Direction assigned per mapping above.
- Safe & idempotent (keyed by `sourceType+sourceId`); no change to source collections.

## 7. Decision

**AD-3 selected:** additive `Transaction` ledger with write-through (see `B-architecture.md` §6).
Preserves V1 modules, satisfies unified Finance, lowest risk.
