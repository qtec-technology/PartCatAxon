import { Router } from 'express';
import { requireAuth } from '#src/middleware/auth.middleware.js';
import * as ctrl from '#src/controllers/axon-handoff.controller.js';

const router = Router();

router.get('/comparisons/:chainId', requireAuth, ctrl.getComparisonByChainId);

export default router;
