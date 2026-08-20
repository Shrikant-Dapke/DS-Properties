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

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id/active', validate(publicIdParamSchema, 'params'), validate(setUserActiveSchema), setActive);
router.post('/:id/reset-password', validate(publicIdParamSchema, 'params'), validate(resetPasswordSchema), resetPassword);
router.put('/:id', validate(publicIdParamSchema, 'params'), validate(updateUserSchema), updateUser);
router.delete('/:id', validate(publicIdParamSchema, 'params'), removeUser);

export default router;