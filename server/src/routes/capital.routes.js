import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as capitalController from '../controllers/capital.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(...WRITE_ROLES), capitalController.create);
router.get('/', authorize(...ALL_ROLES), capitalController.list);
router.get('/:id', authorize(...ALL_ROLES), capitalController.getOne);
router.put('/:id', authorize(...WRITE_ROLES), capitalController.update);

export default router;
