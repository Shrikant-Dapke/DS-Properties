import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as expenseController from '../controllers/expense.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', expenseController.create);
router.get('/', expenseController.list);
router.get('/:id', expenseController.getOne);
router.put('/:id', expenseController.update);
router.delete('/:id', expenseController.remove);

export default router;
