import { Router } from 'express';
import itemRoutes from '#src/routes/item.routes.js';
import termRoutes from '#src/routes/term.routes.js';
import searchRoutes from '#src/routes/search.routes.js';
import lookupRoutes from '#src/routes/lookup.routes.js';
import attachmentRoutes from '#src/routes/attachment.routes.js';
import authRoutes from '#src/routes/auth.routes.js';

// ─── Route Aggregator ───────────────────────────────────────────────────────

const router = Router();

router.use('/items', itemRoutes);
router.use('/terms', termRoutes);
router.use('/search', searchRoutes);
router.use('/lookups', lookupRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/auth', authRoutes);

export default router;
