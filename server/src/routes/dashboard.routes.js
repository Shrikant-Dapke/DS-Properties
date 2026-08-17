import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES } from '../middleware/roles.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authenticate);

router.get('/summary', authorize(...ALL_ROLES), dashboardController.summary);
router.get('/trends', authorize(...ALL_ROLES), dashboardController.trends);
router.get('/recent', authorize(...ALL_ROLES), dashboardController.recent);

export default router;
