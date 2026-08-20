import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { updateSettingSchema } from '../validators/reportValidators.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', getSettings);
router.put('/:key', validate(updateSettingSchema), updateSettings);

export default router;