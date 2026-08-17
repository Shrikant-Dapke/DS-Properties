import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = Router();

router.use(authenticate);

// Payments are append-only financial records in V1.
// No PUT/DELETE routes are defined.
router.post('/', authorize(...WRITE_ROLES), paymentController.create);
router.get('/', authorize(...ALL_ROLES), paymentController.list);
router.get('/:id', authorize(...ALL_ROLES), paymentController.getOne);

export default router;
