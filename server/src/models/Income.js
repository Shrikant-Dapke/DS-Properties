import mongoose from 'mongoose';

const { Schema } = mongoose;

const incomeSchema = new Schema(
  {
    amount: { type: Schema.Types.Decimal128, required: true },
    date: { type: Date, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, trim: true },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

incomeSchema.index({ categoryId: 1 });
incomeSchema.index({ date: -1 });

incomeSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = ret.amount.toString();
    return ret;
  },
});

export default mongoose.model('Income', incomeSchema);
