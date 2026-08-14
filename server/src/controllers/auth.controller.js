import { success } from '../utils/response.js';
import * as authService from '../services/auth.service.js';

export async function login(req, res, next) {
  try {
    const { token, admin } = await authService.login(req.body);
    success(res, { token, admin }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    success(res, req.user, 'Admin profile');
  } catch (err) {
    next(err);
  }
}
