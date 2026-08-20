import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { dashboardSummary, categoryBreakdown } from '../controllers/dashboardController.js';

const router = Router();

router.use(authenticate);

router.get('/summary', dashboardSummary);
router.get('/categories', categoryBreakdown);

export default router;