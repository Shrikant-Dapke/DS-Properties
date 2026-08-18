import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ROLES } from '../middleware/roles.js';
import * as ctrl from '../controllers/changeRequest.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', authorize(ROLES.PARTNER, ROLES.DEVELOPER), ctrl.list);
router.get('/:id', authorize(ROLES.PARTNER, ROLES.DEVELOPER), ctrl.getOne);
router.post('/:id/approve', authorize(ROLES.PARTNER), ctrl.approve);
router.post('/:id/reject', authorize(ROLES.PARTNER), ctrl.reject);
router.post('/:id/cancel', authorize(ROLES.PARTNER, ROLES.DEVELOPER), ctrl.cancel);
router.post('/:id/resubmit', authorize(ROLES.PARTNER), ctrl.resubmit);

export default router;
