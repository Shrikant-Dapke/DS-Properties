import mongoose from 'mongoose';

const { Schema } = mongoose;

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

// A single capital contribution from a partner. The partner's total capital is
// always derived from these entries, never stored as a single cumulative field.
const partnerCapitalSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    date: { type: Date, required: true },
    method: { type: String, enum: METHODS, default: 'Cash' },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

partnerCapitalSchema.index({ partnerId: 1 });
partnerCapitalSchema.index({ date: -1 });

partnerCapitalSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = ret.amount.toString();
    return ret;
  },
});

export default mongoose.model('PartnerCapital', partnerCapitalSchema);
