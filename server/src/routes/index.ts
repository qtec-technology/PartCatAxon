import { Router } from 'express';
import itemRoutes from '#src/routes/item.routes.js';
import termRoutes from '#src/routes/term.routes.js';
import searchRoutes from '#src/routes/search.routes.js';
import lookupRoutes from '#src/routes/lookup.routes.js';
import attachmentRoutes from '#src/routes/attachment.routes.js';
import authRoutes from '#src/routes/auth.routes.js';
import referenceFileRoutes from '#src/routes/reference-file.routes.js';
import bulkCostRoutes from '#src/routes/bulk-cost.routes.js';
import cweightRoutes from '#src/routes/cweight.routes.js';

const router = Router();

router.use('/items', itemRoutes);
router.use('/terms', termRoutes);
router.use('/search', searchRoutes);
router.use('/lookups', lookupRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/auth', authRoutes);
router.use('/reference-files', referenceFileRoutes);
router.use('/bulk-cost', bulkCostRoutes);
router.use('/cweight', cweightRoutes);

export default router;
