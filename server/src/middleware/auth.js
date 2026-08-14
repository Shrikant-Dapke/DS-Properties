import { verifyToken } from '../utils/jwt.js';
import Admin from '../models/Admin.js';
import { AppError } from '../utils/errors.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Authentication required', 401);
    }

    const decoded = verifyToken(token);
    const admin = await Admin.findById(decoded.sub || decoded.id);

    if (!admin || !admin.active) {
      throw new AppError('Account not found or inactive', 401);
    }

    req.user = admin;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired token', 401));
    }
    next(err);
  }
}
