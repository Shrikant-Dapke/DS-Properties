import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as capitalController from '../controllers/capital.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', capitalController.create);
router.get('/', capitalController.list);
router.get('/:id', capitalController.getOne);
router.put('/:id', capitalController.update);

export default router;
