import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES } from '../middleware/roles.js';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

router.use(authenticate);

router.get('/types', authorize(...ALL_ROLES), reportController.listTypes);
router.get('/:type/export', authorize(...ALL_ROLES), reportController.exportFile);
router.get('/:type', authorize(...ALL_ROLES), reportController.generate);

export default router;
