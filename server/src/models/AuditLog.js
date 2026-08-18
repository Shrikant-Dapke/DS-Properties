import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      enum: ['developer', 'partner', 'admin'],
      required: true,
    },
    changeRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChangeRequest',
      default: null,
    },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    operation: {
      type: String,
      enum: [
        'create',
        'update',
        'delete',
        'approve',
        'reject',
        'commit',
        'login',
      ],
      required: true,
    },
    field: { type: String, default: null },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    note: { type: String, default: null },
    at: { type: Date, default: Date.now, index: -1 },
  },
  { timestamps: true }
);

export default mongoose.model('AuditLog', auditLogSchema);
