import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const { token, user } = await authService.login(req.body);
  success(res, { token, user }, 'Login successful');
});

export const me = asyncHandler(async (req, res) => {
  success(res, req.user, 'User profile');
});
