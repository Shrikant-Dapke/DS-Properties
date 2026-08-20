import {
  login as loginService,
  refresh as refreshService,
  logout as logoutService,
  changePassword as changePasswordService,
} from '../services/authService.js';
import { buildContext } from './context.js';

export async function login(req, res) {
  const ctx = buildContext(req);
  const result = await loginService(req.body, ctx);
  res.status(200).json({ success: true, data: result });
}

export async function refresh(req, res) {
  const ctx = buildContext(req);
  const result = await refreshService(req.body, ctx);
  res.status(200).json({ success: true, data: result });
}

export async function logout(req, res) {
  const ctx = buildContext(req);
  const result = await logoutService(req.body, ctx);
  res.status(200).json({ success: true, data: result });
}

export async function changePassword(req, res) {
  const ctx = buildContext(req);
  const result = await changePasswordService(req.body, ctx);
  res.status(200).json({ success: true, data: result });
}