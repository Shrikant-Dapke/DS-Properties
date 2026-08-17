import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as loanController from '../controllers/loan.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(...WRITE_ROLES), loanController.create);
router.get('/', authorize(...ALL_ROLES), loanController.list);
router.get('/:id', authorize(...ALL_ROLES), loanController.getOne);
router.put('/:id', authorize(...WRITE_ROLES), loanController.update);

export default router;
