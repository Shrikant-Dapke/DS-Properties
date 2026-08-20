import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { publicIdParamSchema } from '../validators/common.js';
import {
  dailyReportQuerySchema,
  monthlyReportQuerySchema,
  rangeReportQuerySchema,
} from '../validators/reportValidators.js';
import {
  dailyReport,
  monthlyReport,
  categoryReport,
  partnerReport,
} from '../controllers/reportController.js';

const router = Router();

router.use(authenticate);

router.get('/daily', validate(dailyReportQuerySchema, 'query'), dailyReport);
router.get('/monthly', validate(monthlyReportQuerySchema, 'query'), monthlyReport);
router.get('/categories', validate(rangeReportQuerySchema, 'query'), categoryReport);
router.get('/partners/:id', validate(publicIdParamSchema, 'params'), partnerReport);

export default router;