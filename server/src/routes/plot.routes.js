import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as plotController from '../controllers/plot.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', plotController.create);
router.get('/', plotController.list);
router.get('/:id', plotController.getOne);
router.put('/:id', plotController.update);
router.delete('/:id', plotController.remove);

export default router;
