import { Router } from 'express';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { checkDatabase } from '../config/database.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import customerRoutes from './customerRoutes.js';
import partnerRoutes from './partnerRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import transactionRoutes from './transactionRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import reportRoutes from './reportRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import auditRoutes from './auditRoutes.js';
import changeRequestRoutes from './changeRequestRoutes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await checkDatabase();
    res.json({ success: true, data: { status: 'ok', db: 'up' } });
  } catch {
    res.status(503).json({ success: false, error: { code: 'DEGRADED', message: 'Database unavailable' } });
  }
});

// General API rate limit on everything under /api
router.use(generalLimiter());

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/partners', partnerRoutes);
router.use('/categories', categoryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);
router.use('/audit', auditRoutes);
router.use('/change-requests', changeRequestRoutes);

export default router;