import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { publicIdParamSchema } from '../validators/common.js';
import { decisionBodySchema } from '../validators/governanceValidators.js';
import {
  listChangeRequests,
  getChangeRequest,
  approveChangeHandler,
  rejectChangeHandler,
  cancelChangeHandler,
} from '../controllers/changeRequestController.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', listChangeRequests);
router.get('/:id', validate(publicIdParamSchema, 'params'), getChangeRequest);
router.post('/:id/approve', validate(publicIdParamSchema, 'params'), validate(decisionBodySchema, 'body'), approveChangeHandler);
router.post('/:id/reject', validate(publicIdParamSchema, 'params'), validate(decisionBodySchema, 'body'), rejectChangeHandler);
router.post('/:id/cancel', validate(publicIdParamSchema, 'params'), cancelChangeHandler);

export default router;
