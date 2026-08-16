import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as loanController from '../controllers/loan.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', loanController.create);
router.get('/', loanController.list);
router.get('/:id', loanController.getOne);
router.put('/:id', loanController.update);

export default router;
