import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { withAudit } from '../middleware/auditLogger.js';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
} from '../validators/authValidators.js';
import {
  login,
  refresh,
  logout,
  changePassword,
} from '../controllers/authController.js';

const router = Router();

router.post('/login', authLimiter(), validate(loginSchema), withAudit('auth', 'login'), login);
router.post('/refresh', authLimiter(), validate(refreshSchema), withAudit('auth', 'refresh'), refresh);
router.post('/logout', validate(logoutSchema), logout);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);

export default router;