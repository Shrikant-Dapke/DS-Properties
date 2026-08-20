import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ROLES } from '../config/constants.js';
import { listAuditLogs } from '../controllers/auditController.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', listAuditLogs);

export default router;