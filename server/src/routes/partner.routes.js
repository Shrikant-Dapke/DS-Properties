import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ALL_ROLES, WRITE_ROLES } from '../middleware/roles.js';
import * as partnerController from '../controllers/partner.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(...WRITE_ROLES), partnerController.create);
router.get('/', authorize(...ALL_ROLES), partnerController.list);
router.get('/:id', authorize(...ALL_ROLES), partnerController.getOne);
router.get('/:id/capital-summary', authorize(...ALL_ROLES), partnerController.getSummary);
router.put('/:id', authorize(...WRITE_ROLES), partnerController.update);
router.delete('/:id', authorize(...WRITE_ROLES), partnerController.remove);

export default router;
