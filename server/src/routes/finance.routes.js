import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES } from '../middleware/roles.js';
import * as financeController from '../controllers/finance.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorize(...ALL_ROLES));

// All authenticated roles may read the unified finance ledger.
router.get('/transactions', financeController.list);
router.get('/money-in', financeController.moneyIn);
router.get('/money-out', financeController.moneyOut);
router.get('/summary', financeController.summary);

export default router;
