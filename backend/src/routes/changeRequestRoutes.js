import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { publicIdParamSchema } from '../validators/common.js';
import { decisionBodySchema, cancelBodySchema } from '../validators/governanceValidators.js';
import {
  listChangeRequests,
  getChangeRequest,
  approveChangeHandler,
  rejectChangeHandler,
  cancelChangeHandler,
} from '../controllers/changeRequestController.js';

const router = Router();

// Partners propose and decide business-data requests; admins and the
// developer supervise. Decision authorization (snapshot membership, no
// self-approval, cancellation rules) is enforced server-side in
// governanceService for every call.
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.PARTNER, ROLES.DEVELOPER));

router.get('/', listChangeRequests);
router.get('/:id', validate(publicIdParamSchema, 'params'), getChangeRequest);
router.post('/:id/approve', validate(publicIdParamSchema, 'params'), validate(decisionBodySchema, 'body'), approveChangeHandler);
router.post('/:id/reject', validate(publicIdParamSchema, 'params'), validate(decisionBodySchema, 'body'), rejectChangeHandler);
router.post('/:id/cancel', validate(publicIdParamSchema, 'params'), validate(cancelBodySchema, 'body'), cancelChangeHandler);

export default router;
