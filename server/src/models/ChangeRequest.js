import mongoose from 'mongoose';

const changeFieldSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const approvalSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['requested', 'approved', 'rejected'],
      required: true,
    },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const changeRequestSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    operation: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMMITTED'],
      default: 'PENDING',
      index: true,
    },
    changes: { type: [changeFieldSchema], default: [] },
    approvals: { type: [approvalSchema], default: [] },
    rejectionReason: { type: String, default: null },
    requiredApprovers: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ],
    committedAt: { type: Date, default: null },
    committedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

changeRequestSchema.index({ entityType: 1, entityId: 1 });

export default mongoose.model('ChangeRequest', changeRequestSchema);
