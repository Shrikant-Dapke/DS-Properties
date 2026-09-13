import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createUserSchema,
  updateUserSchema,
  setUserActiveSchema,
  resetPasswordSchema,
} from '../validators/authValidators.js';
import { publicIdParamSchema } from '../validators/common.js';
import {
  listUsers,
  createUser,
  updateUser,
  setActive,
  resetPassword,
  removeUser,
} from '../controllers/userController.js';

const router = Router();

router.use(authenticate);

// Partner operators need the user directory (usernames/roles) to see who
// requested a change and who has approved it. The developer has full user
// management. All writes stay restricted; service-layer guards additionally
// reject any developer-role target or payload coming through the API.
router.get('/', authorize(ROLES.ADMIN, ROLES.PARTNER, ROLES.DEVELOPER), listUsers);
router.post('/', authorize(ROLES.ADMIN, ROLES.DEVELOPER), validate(createUserSchema), createUser);
router.patch('/:id/active', authorize(ROLES.ADMIN, ROLES.DEVELOPER), validate(publicIdParamSchema, 'params'), validate(setUserActiveSchema), setActive);
router.post('/:id/reset-password', authorize(ROLES.ADMIN, ROLES.DEVELOPER), validate(publicIdParamSchema, 'params'), validate(resetPasswordSchema), resetPassword);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.DEVELOPER), validate(publicIdParamSchema, 'params'), validate(updateUserSchema), updateUser);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.DEVELOPER), validate(publicIdParamSchema, 'params'), removeUser);

export default router;