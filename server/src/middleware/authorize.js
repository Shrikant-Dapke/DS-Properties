import { AppError } from '../utils/errors.js';

/**
 * Role-based authorization middleware.
 * Usage: router.post('/', authorize(...WRITE_ROLES), controller.create)
 * Throws 401 if not authenticated, 403 if the user's role is not allowed.
 * The role is always read from the backend-loaded user (req.user), never the client.
 */
export function authorize(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('You are not authorized to perform this action', 403)
      );
    }
    next();
  };
}
