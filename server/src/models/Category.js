import mongoose from 'mongoose';

const { Schema } = mongoose;

const TYPES = ['expense', 'income'];

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: TYPES, required: true },
    isSeed: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    normalizedName: { type: String, required: true },
  },
  { timestamps: true }
);

// Uniqueness is enforced per (type + normalized name), so the same name may
// exist once per type but not twice within the same type (case-insensitive).
categorySchema.index({ type: 1, normalizedName: 1 }, { unique: true });

categorySchema.pre('save', function normalizeName(next) {
  if (this.name) {
    this.name = this.name.trim();
    this.normalizedName = this.name.toLowerCase();
  }
  next();
});

export default mongoose.model('Category', categorySchema);
