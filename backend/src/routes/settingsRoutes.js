import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { updateSettingSchema } from '../validators/reportValidators.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN, ROLES.PARTNER, ROLES.DEVELOPER), getSettings);
// Financial settings shape business-data aggregates: partners propose via
// governance, the developer applies directly. Admins cannot change settings.
router.put('/:key', authorize(ROLES.PARTNER, ROLES.DEVELOPER), validate(updateSettingSchema), updateSettings);

export default router;