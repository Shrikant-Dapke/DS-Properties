import { query, pool } from '../config/database.js';

export const TRANSACTION_COLUMNS = `
  t.id, t.public_id, t.transaction_type, t.source_type,
  t.customer_id, t.partner_id, t.expense_category_id, t.created_by,
  t.amount, t.payment_mode, t.transaction_date, t.reference_number,
  t.plot_number, t.paid_to, t.description,
  t.is_reversal, t.reversed_from_id, t.reversed_at, t.reversal_reason,
  t.created_at, t.updated_at, t.deleted_at,
  c.public_id AS customer_public_id, c.name AS customer_name,
  p.public_id AS partner_public_id, p.name AS partner_name,
  ec.public_id AS category_public_id, ec.name AS category_name,
  u.username AS created_by_username, u.public_id AS created_by_public_id`;

export const JOIN_BASE = `
  FROM transactions t
  LEFT JOIN customers c ON c.id = t.customer_id
  LEFT JOIN partners p ON p.id = t.partner_id
  LEFT JOIN expense_categories ec ON ec.id = t.expense_category_id
  LEFT JOIN users u ON u.id = t.created_by`;

export function findTransactionByPublicId(publicId) {
  return query(
    `SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE} WHERE t.public_id = $1`,
    [publicId],
  ).then((r) => r.rows[0] || null);
}

export function findTransactionById(id) {
  return query(`SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE} WHERE t.id = $1`, [id]).then(
    (r) => r.rows[0] || null,
  );
}

export async function createTransaction(data, client = null) {
  const db = client ?? pool;
  const { rows } = await db.query(
    `INSERT INTO transactions
      (transaction_type, source_type, customer_id, partner_id, expense_category_id,
       amount, payment_mode, transaction_date, reference_number, plot_number,
       paid_to, description, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, public_id`,
    [
      data.transaction_type,
      data.source_type ?? null,
      data.customer_id ?? null,
      data.partner_id ?? null,
      data.expense_category_id ?? null,
      data.amount,
      data.payment_mode,
      data.transaction_date,
      data.reference_number ?? null,
      data.plot_number ?? null,
      data.paid_to ?? null,
      data.description ?? null,
      data.created_by,
    ],
  );
  return findTransactionById(rows[0].id);
}

export function listTransactions({
  type,
  sourceType,
  customerId,
  partnerId,
  categoryId,
  from,
  to,
  search,
  includeDeleted = false,
  limit,
  offset,
}) {
  const where = [];
  const values = [];
  let idx = 1;

  if (!includeDeleted) where.push('t.deleted_at IS NULL');
  if (type) {
    values.push(type);
    where.push(`t.transaction_type = $${idx}`);
    idx += 1;
  }
  if (sourceType) {
    values.push(sourceType);
    where.push(`t.source_type = $${idx}`);
    idx += 1;
  }
  if (customerId) {
    values.push(customerId);
    where.push(`t.customer_id = $${idx}`);
    idx += 1;
  }
  if (partnerId) {
    values.push(partnerId);
    where.push(`t.partner_id = $${idx}`);
    idx += 1;
  }
  if (categoryId) {
    values.push(categoryId);
    where.push(`t.expense_category_id = $${idx}`);
    idx += 1;
  }
  if (from) {
    values.push(from);
    where.push(`t.transaction_date >= $${idx}`);
    idx += 1;
  }
  if (to) {
    values.push(to);
    where.push(`t.transaction_date <= $${idx}`);
    idx += 1;
  }
  if (search) {
    values.push(`%${search}%`);
    where.push(`(t.reference_number ILIKE $${idx} OR t.description ILIKE $${idx} OR t.paid_to ILIKE $${idx} OR c.name ILIKE $${idx} OR p.name ILIKE $${idx})`);
    idx += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countP = query(
    `SELECT count(*)::int AS total FROM transactions t ${whereSql}`,
    values,
  );
  const listP = query(
    `SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE} ${whereSql}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}

export function listCustomerLedger(customerId, {  limit, offset }) {
  const where = 't.customer_id = $1 AND t.deleted_at IS NULL AND t.reversed_at IS NULL';
  const countP = query(
    `SELECT count(*)::int AS total FROM transactions t WHERE ${where}`,
    [customerId],
  );
  const listP = query(
    `SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE}
     WHERE ${where}
     ORDER BY t.transaction_date ASC, t.id ASC
     LIMIT $${2} OFFSET $${3}`,
    [customerId, limit, offset],
  );
  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}

export function listPartnerLedger(partnerId, {  limit, offset }) {
  const where = 't.partner_id = $1 AND t.deleted_at IS NULL AND t.reversed_at IS NULL';
  const countP = query(
    `SELECT count(*)::int AS total FROM transactions t WHERE ${where}`,
    [partnerId],
  );
  const listP = query(
    `SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE}
     WHERE ${where}
     ORDER BY t.transaction_date ASC, t.id ASC
     LIMIT $${2} OFFSET $${3}`,
    [partnerId, limit, offset],
  );
  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}

export function findPotentialDuplicates({ transactionType, amount, customerId, partnerId, categoryId, transactionDate }) {
  return query(
    `SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE}
     WHERE t.transaction_type = $1
       AND t.amount = $2
       AND t.transaction_date = $3
       AND t.deleted_at IS NULL
       AND t.is_reversal = false
       AND (
         ($4::bigint IS NOT NULL AND t.customer_id = $4)
         OR ($5::bigint IS NOT NULL AND t.partner_id = $5)
         OR ($6::bigint IS NOT NULL AND t.expense_category_id = $6)
       )
       AND t.created_at > now() - interval '15 minutes'
     ORDER BY t.created_at DESC`,
    [transactionType, amount, transactionDate, customerId ?? null, partnerId ?? null, categoryId ?? null],
  ).then((r) => r.rows);
}

export async function softDeleteTransaction(id) {
  return query(
    `UPDATE transactions SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id, public_id`,
    [id],
  ).then((r) => r.rows[0] || null);
}

export async function updateTransaction(id, fields) {
  const allowed = [
    'transaction_type',
    'source_type',
    'customer_id',
    'partner_id',
    'expense_category_id',
    'amount',
    'payment_mode',
    'transaction_date',
    'reference_number',
    'plot_number',
    'paid_to',
    'description',
  ];
  const sets = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    sets.push(`${key} = $${idx}`);
    values.push(value ?? null);
    idx += 1;
  }
  if (sets.length === 0) return null;
  values.push(id);
  const { rows } = await query(
    `UPDATE transactions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, public_id`,
    values,
  );
  if (!rows[0]) return null;
  return findTransactionById(rows[0].id);
}

export async function reverseTransaction(id, { userId, reason, client = null }) {
  const db = client ?? pool;
  await db.query('BEGIN');
  try {
    const original = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND deleted_at IS NULL AND reversed_at IS NULL AND is_reversal = false FOR UPDATE`,
      [id],
    ).then((r) => r.rows[0]);

    if (!original) {
      await db.query('ROLLBACK');
      return { error: 'NOT_FOUND_OR_ALREADY_REVERSED' };
    }

    await db.query(
      `UPDATE transactions SET reversed_at = now(), reversed_by = $2, reversal_reason = $3 WHERE id = $1`,
      [id, userId, reason ?? null],
    );

    const reversal = await db.query(
      `INSERT INTO transactions
        (transaction_type, source_type, customer_id, partner_id, expense_category_id,
         amount, payment_mode, transaction_date, reference_number, plot_number,
         paid_to, description, created_by, is_reversal, reversed_from_id, reversal_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14, $15)
       RETURNING id, public_id`,
      [
        original.transaction_type,
        original.source_type,
        original.customer_id,
        original.partner_id,
        original.expense_category_id,
        original.amount,
        original.payment_mode,
        original.transaction_date,
        original.reference_number,
        original.plot_number,
        original.paid_to,
        original.description,
        userId,
        id,
        reason ?? null,
      ],
    );

    await db.query('COMMIT');
    return { reversalId: reversal.rows[0].id, reversalPublicId: reversal.rows[0].public_id };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

// ---------- Aggregations (authoritative, database-side) ----------

const ACTIVE_FLOW_WHERE = `
  deleted_at IS NULL AND reversed_at IS NULL AND is_reversal = false`;

export function partnerInflowTotals(partnerId) {
  return query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE source_type = 'partner_capital'), 0)::numeric(14,2) AS capital_contributions,
       COALESCE(SUM(amount) FILTER (WHERE source_type = 'partner_loan'), 0)::numeric(14,2) AS loan_receipts,
       COALESCE(SUM(amount), 0)::numeric(14,2) AS total_inflow
     FROM transactions
     WHERE partner_id = $1 AND ${ACTIVE_FLOW_WHERE}`,
    [partnerId],
  ).then((r) => r.rows[0]);
}

export function balanceBreakdown() {
  return query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake'), 0)::numeric(14,2) AS total_intake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'outtake'), 0)::numeric(14,2) AS total_outtake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'customer'), 0)::numeric(14,2) AS customer_intake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'partner_capital'), 0)::numeric(14,2) AS partner_capital,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'partner_loan'), 0)::numeric(14,2) AS partner_loan
     FROM transactions
     WHERE ${ACTIVE_FLOW_WHERE}`,
  ).then((r) => r.rows[0]);
}

export function periodSummary({ from, to }) {
  return query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake'), 0)::numeric(14,2) AS total_intake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'outtake'), 0)::numeric(14,2) AS total_outtake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'customer'), 0)::numeric(14,2) AS customer_intake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'partner_capital'), 0)::numeric(14,2) AS partner_capital,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'partner_loan'), 0)::numeric(14,2) AS partner_loan,
       count(*) FILTER (WHERE transaction_type = 'intake')::int AS intake_count,
       count(*) FILTER (WHERE transaction_type = 'outtake')::int AS outtake_count
     FROM transactions
     WHERE ${ACTIVE_FLOW_WHERE} AND transaction_date BETWEEN $1 AND $2`,
    [from, to],
  ).then((r) => r.rows[0]);
}

export function dailyTransactions(date) {
  return query(
    `SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE}
     WHERE t.transaction_date = $1 AND t.deleted_at IS NULL AND t.reversed_at IS NULL
     ORDER BY t.created_at ASC, t.id ASC`,
    [date],
  ).then((r) => r.rows);
}

export function monthlyTransactions({ from, to,  limit, offset }) {
  const values = [from, to, limit, offset];
  const countP = query(
    `SELECT count(*)::int AS total FROM transactions
     WHERE ${ACTIVE_FLOW_WHERE} AND transaction_date BETWEEN $1 AND $2`,
    [from, to],
  );
  const listP = query(
    `SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE}
     WHERE t.transaction_date BETWEEN $1 AND $2 AND t.deleted_at IS NULL AND t.reversed_at IS NULL
     ORDER BY t.transaction_date ASC, t.id ASC
     LIMIT $3 OFFSET $4`,
    values,
  );
  return Promise.all([countP, listP]).then(([c, r]) => ({
    total: c.rows[0].total,
    rows: r.rows,
  }));
}

export function categoryReport({ from, to }) {
  return query(
    `SELECT ec.public_id, ec.name AS category_name, ec.slug,
       COALESCE(SUM(t.amount), 0)::numeric(14,2) AS total_outtake,
       count(t.id)::int AS outtake_count
     FROM expense_categories ec
     LEFT JOIN transactions t ON t.expense_category_id = ec.id
       AND t.transaction_type = 'outtake'
       AND t.deleted_at IS NULL AND t.reversed_at IS NULL AND t.is_reversal = false
       AND t.transaction_date BETWEEN $1 AND $2
     WHERE ec.deleted_at IS NULL
     GROUP BY ec.id
     ORDER BY total_outtake DESC, ec.name ASC`,
    [from, to],
  ).then((r) => r.rows);
}

export function recentTransactions(limit = 10) {
  return query(
    `SELECT ${TRANSACTION_COLUMNS} ${JOIN_BASE}
     WHERE t.deleted_at IS NULL
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT $1`,
    [limit],
  ).then((r) => r.rows);
}

export function balanceUpTo(date) {
  return query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake'), 0)::numeric(14,2) AS total_intake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'outtake'), 0)::numeric(14,2) AS total_outtake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'customer'), 0)::numeric(14,2) AS customer_intake,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'partner_capital'), 0)::numeric(14,2) AS partner_capital,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'intake' AND source_type = 'partner_loan'), 0)::numeric(14,2) AS partner_loan
     FROM transactions
     WHERE ${ACTIVE_FLOW_WHERE} AND transaction_date <= $1`,
    [date],
  ).then((r) => r.rows[0]);
}

export function customerReport({ from, to }) {
  return query(
    `SELECT c.public_id, c.name,
       COALESCE(SUM(t.amount), 0)::numeric(14,2) AS total_intake,
       count(t.id)::int AS intake_count
     FROM customers c
     LEFT JOIN transactions t ON t.customer_id = c.id
       AND t.transaction_type = 'intake' AND t.source_type = 'customer'
       AND t.deleted_at IS NULL AND t.reversed_at IS NULL AND t.is_reversal = false
       AND t.transaction_date BETWEEN $1 AND $2
     WHERE c.deleted_at IS NULL
     GROUP BY c.id
     HAVING SUM(t.amount) IS NOT NULL
     ORDER BY total_intake DESC
     LIMIT 100`,
    [from, to],
  ).then((r) => r.rows);
}