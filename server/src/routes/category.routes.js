import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as categoryController from '../controllers/category.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(...WRITE_ROLES), categoryController.create);
router.get('/', authorize(...ALL_ROLES), categoryController.list);
router.get('/:id', authorize(...ALL_ROLES), categoryController.getOne);
router.put('/:id', authorize(...WRITE_ROLES), categoryController.update);
router.delete('/:id', authorize(...WRITE_ROLES), categoryController.remove);

export default router;
