import { Router } from 'express';
import * as ctrl from '#src/controllers/item.controller.js';
import { requireAuth } from '#src/middleware/auth.middleware.js';
import { validate } from '#src/middleware/validate.middleware.js';
import {
    createItemBodySchema,
    itemDeleteBodySchema,
    itemDuplicateCheckQuerySchema,
    itemImageUploadBodySchema,
    itemIdParamSchema,
    itemListQuerySchema,
    updateItemBodySchema,
} from '#src/dtos/item/item.request.schema.js';

const router = Router();

router.get('/', validate(itemListQuerySchema, 'query'), ctrl.getItems);
router.get('/:id/image', validate(itemIdParamSchema, 'params'), ctrl.getItemImage);
router.post('/:id/image', requireAuth, validate(itemIdParamSchema, 'params'), validate(itemImageUploadBodySchema, 'body'), ctrl.uploadItemImage);
router.get('/:id', validate(itemIdParamSchema, 'params'), ctrl.getItemById);
router.post('/', requireAuth, validate(createItemBodySchema, 'body'), ctrl.createItem);
router.put('/:id', requireAuth, validate(itemIdParamSchema, 'params'), validate(updateItemBodySchema, 'body'), ctrl.updateItem);
router.delete('/:id', requireAuth, validate(itemIdParamSchema, 'params'), validate(itemDeleteBodySchema, 'body'), ctrl.deleteItem);
router.get('/:id/duplicate-check', validate(itemIdParamSchema, 'params'), validate(itemDuplicateCheckQuerySchema, 'query'), ctrl.checkDuplicate);
router.get('/:id/uom', validate(itemIdParamSchema, 'params'), ctrl.getItemUOM);
router.get('/:id/term-count', validate(itemIdParamSchema, 'params'), ctrl.getTermCount);

export default router;
