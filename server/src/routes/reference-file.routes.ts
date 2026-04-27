import { Router } from 'express';
import * as ctrl from '#src/controllers/reference-file.controller.js';

const router = Router();

router.get('/:key', ctrl.openReferenceFile);

export default router;
