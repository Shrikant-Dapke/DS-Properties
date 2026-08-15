import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

router.use(authenticate);

router.get('/types', reportController.listTypes);
router.get('/:type/export', reportController.exportFile);
router.get('/:type', reportController.generate);

export default router;
