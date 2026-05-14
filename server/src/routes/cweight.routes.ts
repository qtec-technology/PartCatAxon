import { Router } from 'express';
import * as ctrl from '#src/controllers/cweight.controller.js';
import { requireAuth } from '#src/middleware/auth.middleware.js';
import { validate } from '#src/middleware/validate.middleware.js';
import { resolveCWeightBodySchema } from '#src/dtos/cweight/cweight.request.schema.js';

const router = Router();

router.post('/resolve', requireAuth, validate(resolveCWeightBodySchema, 'body'), ctrl.resolveCWeight);

export default router;
