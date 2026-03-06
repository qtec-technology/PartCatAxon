import { Router } from 'express';
import * as ctrl from '#src/controllers/term.controller.js';
import { requireAuth } from '#src/middleware/auth.middleware.js';
import { validate } from '#src/middleware/validate.middleware.js';
import {
    cWeightQuerySchema,
    createTermBodySchema,
    masterFGParamSchema,
    previewCalculationBodySchema,
    termDeleteBodySchema,
    termIdParamSchema,
    termsQuerySchema,
    updateTermBodySchema,
} from '#src/dtos/term/term.request.schema.js';

const router = Router();

router.get('/', validate(termsQuerySchema, 'query'), ctrl.getTerms);
router.get('/cweight', validate(cWeightQuerySchema, 'query'), ctrl.getCWeight);
router.get('/master-fg/:itemId', validate(masterFGParamSchema, 'params'), ctrl.getMasterFG);
router.get('/:id', validate(termIdParamSchema, 'params'), ctrl.getTermById);
router.post('/', requireAuth, validate(createTermBodySchema, 'body'), ctrl.createTerm);
router.put('/:id', requireAuth, validate(termIdParamSchema, 'params'), validate(updateTermBodySchema, 'body'), ctrl.updateTerm);
router.delete('/:id', requireAuth, validate(termIdParamSchema, 'params'), validate(termDeleteBodySchema, 'body'), ctrl.deleteTerm);
router.post('/calculate', validate(previewCalculationBodySchema, 'body'), ctrl.previewCalculation);
router.get('/:id/vendor-email', validate(termIdParamSchema, 'params'), ctrl.getVendorEmail);
router.get('/:id/item-detail', validate(termIdParamSchema, 'params'), ctrl.getItemDetailByTerm);

export default router;
