import mongoose from 'mongoose';

const plotSchema = new mongoose.Schema(
  {
    plotNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    area: { type: Number },
    areaUnit: { type: String, trim: true },
    location: { type: String, trim: true },
    price: { type: mongoose.Schema.Types.Decimal128, required: true },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Allocated', 'Sold'],
      default: 'Available',
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

plotSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.price) ret.price = ret.price.toString();
    return ret;
  },
});

export default mongoose.model('Plot', plotSchema);
