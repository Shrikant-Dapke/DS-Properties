import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as incomeController from '../controllers/income.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', incomeController.create);
router.get('/', incomeController.list);
router.get('/:id', incomeController.getOne);
router.put('/:id', incomeController.update);

export default router;
