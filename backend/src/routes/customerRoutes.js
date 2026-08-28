import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomerQuerySchema,
} from '../validators/customerValidators.js';
import { publicIdParamSchema } from '../validators/common.js';
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  customerLedger,
} from '../controllers/customerController.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(listCustomerQuerySchema, 'query'), listCustomers);
router.post('/', authorize(ROLES.ADMIN), validate(createCustomerSchema), createCustomer);
router.get('/:id/ledger', validate(publicIdParamSchema, 'params'), customerLedger);
router.get('/:id', validate(publicIdParamSchema, 'params'), getCustomerById);
router.put('/:id', authorize(ROLES.ADMIN), validate(publicIdParamSchema, 'params'), validate(updateCustomerSchema), updateCustomer);
router.delete('/:id', authorize(ROLES.ADMIN), validate(publicIdParamSchema, 'params'), deleteCustomer);

export default router;