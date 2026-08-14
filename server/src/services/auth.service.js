import Admin from '../models/Admin.js';
import { signToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

export async function login({ username, password }) {
  if (!username || !password) {
    throw new AppError('Username and password are required', 400);
  }

  const admin = await Admin.findOne({ username: username.toLowerCase() });

  if (!admin || !admin.active) {
    throw new AppError('Invalid credentials', 401);
  }

  const valid = await admin.verifyPassword(password);
  if (!valid) {
    throw new AppError('Invalid credentials', 401);
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  const token = signToken({
    sub: admin._id.toString(),
    role: admin.role,
  });

  return { token, admin };
}
