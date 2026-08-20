import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionQuerySchema,
  reverseTransactionSchema,
  destructiveTransactionSchema,
} from '../validators/transactionValidators.js';
import { publicIdParamSchema } from '../validators/common.js';
import {
  createTransaction,
  listTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  reverseTransaction,
} from '../controllers/transactionController.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(ROLES.ADMIN, ROLES.OPERATOR), validate(createTransactionSchema), createTransaction);
router.get('/', validate(listTransactionQuerySchema, 'query'), listTransactions);
router.get('/:id', validate(publicIdParamSchema, 'params'), getTransactionById);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.OPERATOR), validate(publicIdParamSchema, 'params'), validate(updateTransactionSchema), updateTransaction);
router.post('/:id/reverse', authorize(ROLES.ADMIN), validate(publicIdParamSchema, 'params'), validate(reverseTransactionSchema), reverseTransaction);
router.delete('/:id', authorize(ROLES.ADMIN), validate(publicIdParamSchema, 'params'), validate(destructiveTransactionSchema), deleteTransaction);

export default router;