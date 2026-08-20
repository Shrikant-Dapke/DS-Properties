import { AuthorizationError } from '../utils/errors.js';

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthorizationError('Not authenticated'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError('You do not have permission to perform this action'));
    }
    return next();
  };
}