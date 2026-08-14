import mongoose from 'mongoose';

const { Schema } = mongoose;

const expenseSchema = new Schema(
  {
    amount: { type: Schema.Types.Decimal128, required: true },
    date: { type: Date, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, trim: true },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

expenseSchema.index({ categoryId: 1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ deleted: 1 });

expenseSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = ret.amount.toString();
    return ret;
  },
});

export default mongoose.model('Expense', expenseSchema);
