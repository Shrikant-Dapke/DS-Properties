-- 005: transactions (core financial records)
CREATE TABLE IF NOT EXISTS transactions (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id            uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_type     text NOT NULL CHECK (transaction_type IN ('intake', 'outtake')),
  source_type          text CHECK (
                          source_type IN ('customer', 'partner_capital', 'partner_loan')
                          OR source_type IS NULL
                        ),
  customer_id          bigint REFERENCES customers (id) ON DELETE RESTRICT,
  partner_id           bigint REFERENCES partners (id) ON DELETE RESTRICT,
  expense_category_id  bigint REFERENCES expense_categories (id) ON DELETE RESTRICT,
  amount               numeric(14, 2) NOT NULL CHECK (amount > 0),
  payment_mode         text NOT NULL CHECK (payment_mode IN ('cash', 'cheque', 'upi', 'bank_transfer')),
  transaction_date     date NOT NULL,
  reference_number     text,
  plot_number          text,
  paid_to              text,
  description          text,
  created_by           bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  is_reversal          boolean NOT NULL DEFAULT false,
  reversed_from_id     bigint REFERENCES transactions (id) ON DELETE RESTRICT,
  reversed_at          timestamptz,
  reversed_by          bigint REFERENCES users (id) ON DELETE RESTRICT,
  reversal_reason      text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,

  -- inflow/outflow classification must be coherent
  CONSTRAINT chk_transactions_source_flow CHECK (
    (transaction_type = 'outtake' AND source_type IS NULL)
    OR (transaction_type = 'intake' AND source_type = 'customer' AND customer_id IS NOT NULL AND partner_id IS NULL AND expense_category_id IS NULL)
    OR (transaction_type = 'intake' AND source_type IN ('partner_capital', 'partner_loan') AND partner_id IS NOT NULL AND customer_id IS NULL AND expense_category_id IS NULL)
  ),
  -- outtakes must be categorized; intakes must not
  CONSTRAINT chk_transactions_category CHECK (
    (transaction_type = 'outtake' AND expense_category_id IS NOT NULL)
    OR (transaction_type = 'intake' AND expense_category_id IS NULL)
  ),
  -- reversals must reference their origin
  CONSTRAINT chk_transactions_reversal CHECK (
    (is_reversal = true AND reversed_from_id IS NOT NULL AND transaction_type IS NOT NULL)
    OR (is_reversal = false)
  )
);

CREATE UNIQUE INDEX uq_transactions_public_id ON transactions (public_id);
CREATE INDEX ix_transactions_date ON transactions (transaction_date);
CREATE INDEX ix_transactions_type_source ON transactions (transaction_type, source_type);
CREATE INDEX ix_transactions_customer ON transactions (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_transactions_partner ON transactions (partner_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_transactions_category ON transactions (expense_category_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_transactions_created_by ON transactions (created_by);
CREATE INDEX ix_transactions_reversed_from ON transactions (reversed_from_id);
-- fast path for balance aggregation
CREATE INDEX ix_transactions_active_flow ON transactions (transaction_type, source_type)
  WHERE deleted_at IS NULL AND reversed_at IS NULL AND is_reversal = false;