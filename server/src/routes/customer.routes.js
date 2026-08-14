import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as customerController from '../controllers/customer.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', customerController.create);
router.get('/', customerController.list);
router.get('/:id', customerController.getOne);
router.put('/:id', customerController.update);
router.delete('/:id', customerController.remove);

export default router;
