import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as customerController from '../controllers/customer.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(...WRITE_ROLES), customerController.create);
router.get('/', authorize(...ALL_ROLES), customerController.list);
router.get('/:id', authorize(...ALL_ROLES), customerController.getOne);
router.put('/:id', authorize(...WRITE_ROLES), customerController.update);
router.delete('/:id', authorize(...WRITE_ROLES), customerController.remove);

export default router;
