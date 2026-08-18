import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    direction: {
      type: String,
      enum: ['in', 'out'],
      required: true,
      index: true,
    },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    date: { type: Date, required: true, index: -1 },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    sourceType: {
      type: String,
      enum: ['payment', 'income', 'expense', 'capital', 'loan'],
      required: true,
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      default: null,
    },
    plotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plot',
      default: null,
    },
    method: { type: String, default: null },
    reference: { type: String, default: null },
    description: { type: String, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// One ledger row per source record (idempotent write-through key).
transactionSchema.index(
  { sourceType: 1, sourceId: 1 },
  { unique: true }
);
transactionSchema.index({ customerId: 1 });
transactionSchema.index({ partnerId: 1 });
transactionSchema.index({ plotId: 1 });
transactionSchema.index({ categoryId: 1 });

transactionSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = ret.amount.toString();
    return ret;
  },
});

export default mongoose.model('Transaction', transactionSchema);
