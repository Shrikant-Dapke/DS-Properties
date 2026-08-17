import mongoose from 'mongoose';

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    // Link to the authenticated User (role: 'partner') that owns this business record.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true }
);

export default mongoose.model('Partner', partnerSchema);
