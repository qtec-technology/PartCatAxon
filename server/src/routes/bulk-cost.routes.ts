import { Router } from 'express';
import * as ctrl from '#src/controllers/bulk-cost.controller.js';
import { requireAuth } from '#src/middleware/auth.middleware.js';
import { validate } from '#src/middleware/validate.middleware.js';
import {
    listBulkCostRunsQuerySchema,
    bulkCostCWeightPrefillBodySchema,
    saveBulkCostRunBodySchema,
    updateBulkCostRunStatusBodySchema,
} from '#src/dtos/bulk-cost/bulk-cost.request.schema.js';

const router = Router();

router.get('/queue', requireAuth, ctrl.getQueueItems);
router.post('/cweight-prefill', requireAuth, validate(bulkCostCWeightPrefillBodySchema, 'body'), ctrl.resolveCWeightPrefill);
router.get('/runs', requireAuth, validate(listBulkCostRunsQuerySchema, 'query'), ctrl.getRunsList);
router.get('/runs/:id', requireAuth, ctrl.getRunById);
router.post('/runs', requireAuth, validate(saveBulkCostRunBodySchema, 'body'), ctrl.createBulkCostRun);
router.patch('/runs/:id/status', requireAuth, validate(updateBulkCostRunStatusBodySchema, 'body'), ctrl.updateRunStatus);

export default router;
