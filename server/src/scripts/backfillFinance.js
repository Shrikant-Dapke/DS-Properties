/**
 * backfillFinance.js — ADDITIVE, IDEMPOTENT historical backfill
 * ============================================================
 * Creates `Transaction` ledger rows from existing source records
 * (payments, incomes, non-deleted expenses, partner capital, loans).
 *
 * - Safe: never modifies or deletes source records.
 * - Idempotent: keyed on (sourceType, sourceId) via upsert, so it can be
 *   run repeatedly without creating duplicates.
 *
 * Run with:  npm run backfill:finance
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { syncTransaction } from '../services/finance.service.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Payment from '../models/Payment.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import PartnerCapital from '../models/PartnerCapital.js';
import LoanReceived from '../models/LoanReceived.js';

const BATCH = [
  { entityType: 'Payment', model: Payment },
  { entityType: 'Income', model: Income },
  { entityType: 'PartnerCapital', model: PartnerCapital },
  { entityType: 'LoanReceived', model: LoanReceived },
  // Expenses: only official (non-deleted) records.
  { entityType: 'Expense', model: Expense, filter: { deleted: false } },
];

/**
 * Run the backfill against the currently-open Mongoose connection.
 * Safe and idempotent: each source record is upserted into the ledger by
 * (sourceType, sourceId), so running it repeatedly never creates duplicates.
 * Returns the number of source records processed.
 */
export async function runBackfill() {
  let total = 0;
  for (const { entityType, model, filter } of BATCH) {
    const query = filter || {};
    const docs = await model.find(query).lean();
    let count = 0;
    for (const doc of docs) {
      // syncTransaction expects a Mongoose doc for `_id` and field access;
      // a lean object still carries those fields and is sufficient here.
      await syncTransaction(entityType, doc, { operation: 'create' });
      count += 1;
    }
    console.log(`  ${entityType.padEnd(14)} : ${count} records -> transactions`);
    total += count;
  }
  return total;
}

async function main() {
  await mongoose.connect(env.mongoUri);
  console.log(`Connected to ${env.mongoUri}\n`);
  const total = await runBackfill();
  console.log(`\nBackfill complete. ${total} source records processed.`);
  await mongoose.disconnect();
}

// Only run when executed directly (e.g. `npm run backfill:finance`), not when
// imported as a module (e.g. by tests that call runBackfill() on their own DB).
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error('Finance backfill failed:', err.message);
    process.exit(1);
  });
}
