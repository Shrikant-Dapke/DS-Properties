import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as partnerController from '../controllers/partner.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', partnerController.create);
router.get('/', partnerController.list);
router.get('/:id', partnerController.getOne);
router.get('/:id/capital-summary', partnerController.getSummary);
router.put('/:id', partnerController.update);
router.delete('/:id', partnerController.remove);

export default router;
