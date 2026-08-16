import mongoose from 'mongoose';

const { Schema } = mongoose;

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

// Money borrowed by the business. Distinct from customer payments and partner
// capital; never counted as revenue.
const loanReceivedSchema = new Schema(
  {
    lender: { type: String, required: true, trim: true, index: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    date: { type: Date, required: true },
    method: { type: String, enum: METHODS, default: 'Cash' },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

loanReceivedSchema.index({ lender: 1 });
loanReceivedSchema.index({ date: -1 });

loanReceivedSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = ret.amount.toString();
    return ret;
  },
});

export default mongoose.model('LoanReceived', loanReceivedSchema);
