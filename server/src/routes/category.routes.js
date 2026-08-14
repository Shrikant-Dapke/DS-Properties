import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as categoryController from '../controllers/category.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', categoryController.create);
router.get('/', categoryController.list);
router.get('/:id', categoryController.getOne);
router.put('/:id', categoryController.update);
router.delete('/:id', categoryController.remove);

export default router;
