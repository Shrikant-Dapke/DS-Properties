import mongoose from 'mongoose';

const { Schema } = mongoose;

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

const paymentSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    plotId: { type: Schema.Types.ObjectId, ref: 'Plot', required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    date: { type: Date, required: true },
    method: { type: String, enum: METHODS, default: 'Cash' },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

paymentSchema.index({ plotId: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ date: -1 });

paymentSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = ret.amount.toString();
    return ret;
  },
});

export default mongoose.model('Payment', paymentSchema);
