import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ROLES = ['developer', 'partner', 'admin'];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
    role: { type: String, enum: ROLES, required: true },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      default: null,
    },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    preferredLocale: { type: String, enum: ['en', 'mr'], default: 'en' },
  },
  { timestamps: true }
);

userSchema.index({ partnerId: 1 });

userSchema.methods.verifyPassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export default mongoose.model('User', userSchema);
