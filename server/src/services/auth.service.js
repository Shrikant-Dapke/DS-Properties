import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

export async function login({ username, password }) {
  if (!username || !password) {
    throw new AppError('Username and password are required', 400);
  }

  const user = await User.findOne({ username: username.toLowerCase() });

  if (!user || !user.active) {
    throw new AppError('Invalid credentials', 401);
  }

  const valid = await user.verifyPassword(password);
  if (!valid) {
    throw new AppError('Invalid credentials', 401);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const payload = {
    sub: user._id.toString(),
    role: user.role,
  };
  // Include the linked Partner id for partner users (handy for downstream checks).
  if (user.role === 'partner' && user.partnerId) {
    payload.pid = user.partnerId.toString();
  }

  const token = signToken(payload);

  return { token, user };
}
