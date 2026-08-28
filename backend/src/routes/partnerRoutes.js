import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createPartnerSchema,
  updatePartnerSchema,
  listPartnerQuerySchema,
} from '../validators/partnerValidators.js';
import { publicIdParamSchema } from '../validators/common.js';
import {
  listPartners,
  getPartnerById,
  createPartner,
  updatePartner,
  deletePartner,
  partnerLedger,
} from '../controllers/partnerController.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(listPartnerQuerySchema, 'query'), listPartners);
router.post('/', authorize(ROLES.ADMIN), validate(createPartnerSchema), createPartner);
router.get('/:id/ledger', validate(publicIdParamSchema, 'params'), partnerLedger);
router.get('/:id', validate(publicIdParamSchema, 'params'), getPartnerById);
router.put('/:id', authorize(ROLES.ADMIN), validate(publicIdParamSchema, 'params'), validate(updatePartnerSchema), updatePartner);
router.delete('/:id', authorize(ROLES.ADMIN), validate(publicIdParamSchema, 'params'), deletePartner);

export default router;