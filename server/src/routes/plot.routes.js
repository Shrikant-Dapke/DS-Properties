import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as plotController from '../controllers/plot.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(...WRITE_ROLES), plotController.create);
router.get('/', authorize(...ALL_ROLES), plotController.list);
router.get('/:id', authorize(...ALL_ROLES), plotController.getOne);
router.put('/:id', authorize(...WRITE_ROLES), plotController.update);
router.delete('/:id', authorize(...WRITE_ROLES), plotController.remove);

export default router;
