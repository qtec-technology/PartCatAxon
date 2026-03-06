import { Router } from 'express';
import * as ctrl from '#src/controllers/search.controller.js';
import { validate } from '#src/middleware/validate.middleware.js';
import {
    searchFTSAutocompleteQuerySchema,
    searchFTSBrandsQuerySchema,
    searchFTSQuerySchema,
    searchPartNoQuerySchema,
    searchStandardQuerySchema,
} from '#src/dtos/search/search.request.schema.js';

const router = Router();

router.get('/fts', validate(searchFTSQuerySchema, 'query'), ctrl.searchFTS);
router.get('/fts/brands', validate(searchFTSBrandsQuerySchema, 'query'), ctrl.searchFTSBrands);
router.get('/fts/autocomplete', validate(searchFTSAutocompleteQuerySchema, 'query'), ctrl.searchFTSAutocomplete);
router.get('/standard', validate(searchStandardQuerySchema, 'query'), ctrl.searchStandard);
router.get('/partno', validate(searchPartNoQuerySchema, 'query'), ctrl.searchPartNo);

export default router;
