import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authenticate);

router.get('/summary', dashboardController.summary);
router.get('/trends', dashboardController.trends);
router.get('/recent', dashboardController.recent);

export default router;
