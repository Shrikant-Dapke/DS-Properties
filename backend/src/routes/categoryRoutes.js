import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoryQuerySchema,
} from '../validators/categoryValidators.js';
import { publicIdParamSchema } from '../validators/common.js';
import {
  listCategories,
  listActiveCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';

const router = Router();

router.use(authenticate);

router.get('/active', listActiveCategories);
router.get('/', validate(listCategoryQuerySchema, 'query'), listCategories);
router.get('/:id', validate(publicIdParamSchema, 'params'), getCategoryById);
router.post('/', authorize(ROLES.ADMIN), validate(createCategorySchema), createCategory);
router.put('/:id', authorize(ROLES.ADMIN), validate(publicIdParamSchema, 'params'), validate(updateCategorySchema), updateCategory);
router.delete('/:id', authorize(ROLES.ADMIN), validate(publicIdParamSchema, 'params'), deleteCategory);

export default router;