import { Router } from 'express';
import * as ctrl from '#src/controllers/auth.controller.js';

const router = Router();

router.get('/whoami', ctrl.whoami);
router.get('/user-picture', ctrl.getUserPicture);

export default router;
