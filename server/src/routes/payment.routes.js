import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = Router();

router.use(authenticate);

// Payments are append-only financial records in V1.
// No PUT/DELETE routes are defined.
router.post('/', paymentController.create);
router.get('/', paymentController.list);
router.get('/:id', paymentController.getOne);

export default router;
