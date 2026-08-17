import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as incomeController from '../controllers/income.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(...WRITE_ROLES), incomeController.create);
router.get('/', authorize(...ALL_ROLES), incomeController.list);
router.get('/:id', authorize(...ALL_ROLES), incomeController.getOne);
router.put('/:id', authorize(...WRITE_ROLES), incomeController.update);

export default router;
