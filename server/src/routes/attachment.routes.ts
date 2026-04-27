import { Router } from 'express';
import * as ctrl from '#src/controllers/attachment.controller.js';
import { requireAuth } from '#src/middleware/auth.middleware.js';
import { validate } from '#src/middleware/validate.middleware.js';
import {
    attachmentDeleteQuerySchema,
    attachmentIdParamSchema,
    createAttachmentBodySchema,
} from '#src/dtos/attachment/attachment.request.schema.js';

const router = Router();

router.get('/:id/download', validate(attachmentIdParamSchema, 'params'), validate(attachmentDeleteQuerySchema, 'query'), ctrl.downloadAttachment);
router.post('/', requireAuth, validate(createAttachmentBodySchema, 'body'), ctrl.createAttachment);
router.delete('/:id', requireAuth, validate(attachmentIdParamSchema, 'params'), validate(attachmentDeleteQuerySchema, 'query'), ctrl.deleteAttachment);

export default router;
