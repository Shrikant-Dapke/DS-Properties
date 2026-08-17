import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as expenseController from '../controllers/expense.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(...WRITE_ROLES), expenseController.create);
router.get('/', authorize(...ALL_ROLES), expenseController.list);
router.get('/:id', authorize(...ALL_ROLES), expenseController.getOne);
router.put('/:id', authorize(...WRITE_ROLES), expenseController.update);
router.delete('/:id', authorize(...WRITE_ROLES), expenseController.remove);

export default router;
