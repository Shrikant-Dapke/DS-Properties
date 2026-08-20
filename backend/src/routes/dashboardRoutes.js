import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { optionalDateRangeSchema } from '../validators/common.js';
import { dashboardSummary, categoryBreakdown } from '../controllers/dashboardController.js';

const router = Router();

router.use(authenticate);

router.get('/summary', validate(optionalDateRangeSchema, 'query'), dashboardSummary);
router.get('/categories', validate(optionalDateRangeSchema, 'query'), categoryBreakdown);

export default router;