import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import Transaction from '../models/Transaction.js';

// Entity types that contribute to the unified finance ledger.
export const FINANCIAL_ENTITY_TYPES = [
  'Payment',
  'Income',
  'Expense',
  'PartnerCapital',
  'LoanReceived',
];

const FINANCIAL_ENTITIES = new Set(FINANCIAL_ENTITY_TYPES);

// Maps a source model name to the ledger `sourceType` discriminator.
const SOURCE_TYPE = {
  Payment: 'payment',
  Income: 'income',
  Expense: 'expense',
  PartnerCapital: 'capital',
  LoanReceived: 'loan',
};

function toObjectId(value) {
  if (!value) return null;
  // A populated subdocument carries the id on `_id`.
  let id = value;
  if (typeof value === 'object' && value._id) id = value._id;
  const str = id.toString();
  return mongoose.Types.ObjectId.isValid(str)
    ? new mongoose.Types.ObjectId(str)
    : null;
}

function toDecimal128(value) {
  if (value === null || value === undefined) return null;
  return mongoose.Types.Decimal128.fromString(new Decimal(value.toString()).toString());
}

function toStringOrNull(value) {
  return value === null || value === undefined ? null : String(value);
}

// Maps a source-model instance into ledger fields. Returns null when the
// entity type is not part of the finance ledger.
function mapEntityToTransaction(entityType, doc) {
  switch (entityType) {
    case 'Payment':
      return {
        direction: 'in',
        amount: doc.amount,
        date: doc.date,
        sourceType: 'payment',
        sourceId: doc._id,
        customerId: doc.customerId,
        plotId: doc.plotId,
        partnerId: null,
        categoryId: null,
        method: doc.method,
        reference: doc.reference,
        description: doc.notes,
      };
    case 'Income':
      return {
        direction: 'in',
        amount: doc.amount,
        date: doc.date,
        sourceType: 'income',
        sourceId: doc._id,
        customerId: null,
        plotId: null,
        partnerId: null,
        categoryId: doc.categoryId,
        method: doc.method,
        reference: doc.reference,
        description: doc.description,
      };
    case 'Expense':
      return {
        direction: 'out',
        amount: doc.amount,
        date: doc.date,
        sourceType: 'expense',
        sourceId: doc._id,
        customerId: null,
        plotId: null,
        partnerId: null,
        categoryId: doc.categoryId,
        method: doc.method,
        reference: doc.reference,
        description: doc.description,
      };
    case 'PartnerCapital':
      return {
        direction: 'in',
        amount: doc.amount,
        date: doc.date,
        sourceType: 'capital',
        sourceId: doc._id,
        customerId: null,
        plotId: null,
        partnerId: doc.partnerId,
        categoryId: null,
        method: doc.method,
        reference: doc.reference,
        description: doc.notes,
      };
    case 'LoanReceived':
      return {
        direction: 'in',
        amount: doc.amount,
        date: doc.date,
        sourceType: 'loan',
        sourceId: doc._id,
        customerId: null,
        plotId: null,
        partnerId: null,
        categoryId: null,
        method: doc.method,
        reference: doc.reference,
        description: [toStringOrNull(doc.lender) ? `From ${doc.lender}` : null, doc.notes]
          .filter(Boolean)
          .join('. '),
      };
    default:
      return null;
  }
}

/**
 * Write-through a source record into the unified Transaction ledger.
 * Idempotent: keyed on (sourceType, sourceId). For `operation: 'delete'`
 * the ledger row is removed instead of upserted.
 */
export async function syncTransaction(
  entityType,
  doc,
  { committedBy = null, operation = 'create', session = null } = {}
) {
  if (!FINANCIAL_ENTITIES.has(entityType) || !doc) return null;

  const sourceType = SOURCE_TYPE[entityType];
  const sourceId = toObjectId(doc._id);
  if (!sourceId) return null;

  if (operation === 'delete') {
    await Transaction.deleteOne({ sourceType, sourceId }, session ? { session } : undefined);
    return null;
  }

  const fields = mapEntityToTransaction(entityType, doc);
  if (!fields) return null;

  const ledger = {
    direction: fields.direction,
    amount: toDecimal128(fields.amount),
    date: new Date(fields.date),
    sourceType: fields.sourceType,
    sourceId,
    customerId: toObjectId(fields.customerId),
    partnerId: toObjectId(fields.partnerId),
    plotId: toObjectId(fields.plotId),
    categoryId: toObjectId(fields.categoryId),
    method: toStringOrNull(fields.method),
    reference: toStringOrNull(fields.reference),
    description: toStringOrNull(fields.description),
    createdBy: toObjectId(committedBy),
  };

  await Transaction.findOneAndUpdate(
    { sourceType, sourceId },
    ledger,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      ...(session ? { session } : {}),
    }
  );
  return true;
}

export async function removeTransaction(entityType, sourceId, { session = null } = {}) {
  const sourceType = SOURCE_TYPE[entityType];
  if (!sourceType) return;
  const id = toObjectId(sourceId);
  if (!id) return;
  await Transaction.deleteOne({ sourceType, sourceId: id }, session ? { session } : undefined);
}

/**
 * Run `fn(session)` inside a MongoDB transaction so a source financial record
 * and its ledger row are written atomically (both commit or both roll back).
 * If an external `session` is supplied (e.g. a partner change-request commit),
 * it is reused instead of starting a new transaction.
 */
export async function runInTransaction(fn, { session: externalSession } = {}) {
  if (externalSession) return fn(externalSession);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => fn(session));
  } finally {
    await session.endSession();
  }
}

// ---- Read side -------------------------------------------------------

function buildFilter({
  direction,
  dateFrom,
  dateTo,
  customer,
  partner,
  plot,
  category,
  sourceType,
} = {}) {
  const filter = {};
  if (direction === 'in' || direction === 'out') filter.direction = direction;
  if (sourceType) filter.sourceType = sourceType;
  if (customer) filter.customerId = toObjectId(customer);
  if (partner) filter.partnerId = toObjectId(partner);
  if (plot) filter.plotId = toObjectId(plot);
  if (category) filter.categoryId = toObjectId(category);

  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) range.$lte = d;
    }
    if (Object.keys(range).length) filter.date = range;
  }
  return filter;
}

export async function listTransactions({
  direction,
  dateFrom,
  dateTo,
  customer,
  partner,
  plot,
  category,
  sourceType,
  page = 1,
  limit = 25,
} = {}) {
  const filter = buildFilter({
    direction,
    dateFrom,
    dateTo,
    customer,
    partner,
    plot,
    category,
    sourceType,
  });

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (pageNum - 1) * limitNum;

  const [items, total, sumRows] = await Promise.all([
    Transaction.find(filter)
      .populate('customerId', 'name')
      .populate('partnerId', 'name')
      .populate('plotId', 'plotNumber')
      .populate('categoryId', 'name type')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$direction',
          total: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const totals = { in: '0', out: '0' };
  for (const row of sumRows) {
    totals[row._id] = new Decimal(row.total.toString()).toString();
  }

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
    totals: {
      in: totals.in,
      out: totals.out,
      net: new Decimal(totals.in).minus(new Decimal(totals.out)).toString(),
    },
  };
}

export async function getFinanceSummary() {
  const [rows, bySource] = await Promise.all([
    Transaction.aggregate([
      { $group: { _id: '$direction', total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $group: { _id: { sourceType: '$sourceType', direction: '$direction' }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const overall = { in: '0', out: '0' };
  for (const r of rows) overall[r._id] = new Decimal(r.total.toString()).toString();

  const bySourceType = {};
  for (const r of bySource) {
    const key = r._id.sourceType;
    if (!bySourceType[key]) bySourceType[key] = { in: '0', out: '0' };
    bySourceType[key][r._id.direction] = new Decimal(r.total.toString()).toString();
  }

  return {
    totals: {
      in: overall.in,
      out: overall.out,
      net: new Decimal(overall.in).minus(new Decimal(overall.out)).toString(),
    },
    bySourceType,
    count: await Transaction.estimatedDocumentCount(),
  };
}
