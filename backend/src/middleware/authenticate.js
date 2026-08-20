import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { UnauthorizedError } from '../utils/errors.js';
import { findUserById } from '../models/userModel.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedError('Missing or malformed authorization header');
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const user = await findUserById(payload.sub);
    if (!user || !user.is_active || user.deleted_at) {
      throw new UnauthorizedError('User is not active');
    }

    req.user = {
      id: user.id,
      publicId: user.public_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    };
    req.tokenType = 'access';
    return next();
  } catch (err) {
    return next(err);
  }
}