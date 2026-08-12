import { Router } from 'express';
import { router as jobsRouter } from './jobs.routes.js';
import { router as pricesRouter } from './prices.routes.js';
import { router as importRouter } from './import.routes.js';
import { router as webhooksRouter } from './webhooks.routes.js';
import { router as abTestRouter } from './ab-test.routes.js';

export const router = Router();

router.use('/', jobsRouter);
router.use('/', pricesRouter);
router.use('/', importRouter);
router.use('/', webhooksRouter);
router.use('/', abTestRouter);

export default router;
