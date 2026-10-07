/**
 * AI Routes - API endpoints для AI-интеграции с кэшированием
 * Фаза 7.5: AI-интеграция
 *
 * Фасад: сами handlers живут в ./ai/handlers/ (по одному на эндпоинт).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { statusHandler } from './ai/handlers/status.js';
import { historyHandler } from './ai/handlers/history.js';
import { statsHandler } from './ai/handlers/stats.js';
import { estimateHandler } from './ai/handlers/estimate.js';
import { suggestMaterialsHandler } from './ai/handlers/suggestMaterials.js';
import { generateTemplateHandler } from './ai/handlers/generateTemplate.js';
import { searchPriceHandler } from './ai/handlers/searchPrice.js';

const router = Router();

router.use(authenticate);
router.use(aiRateLimiter);

router.get('/status', statusHandler);
router.get('/history', historyHandler);
router.get('/stats', statsHandler);
router.post('/estimate', estimateHandler);
router.post('/suggest-materials', suggestMaterialsHandler);
router.post('/generate-template', generateTemplateHandler);
router.post('/search-price', searchPriceHandler);

export default router;
