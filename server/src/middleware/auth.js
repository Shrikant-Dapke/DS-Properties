import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Authentication required', 401);
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub || decoded.id);

    if (!user || !user.active) {
      throw new AppError('Account not found or inactive', 401);
    }

    // Authoritative identity — never trust a client-supplied role.
    req.user = user;

    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired token', 401));
    }
    next(err);
  }
}
