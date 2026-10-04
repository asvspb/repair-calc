import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  checkRoomAccess,
  createOpening,
  listOpenings,
  updateOpening,
  deleteOpening,
  reorderOpenings,
  createSubSection,
  listSubSections,
  updateSubSection,
  deleteSubSection,
  reorderSubSections,
  reorderWorks,
} from './geometry.controller.js';
import {
  createSegment,
  listSegments,
  updateSegment,
  deleteSegment,
  reorderSegments,
  createObstacle,
  listObstacles,
  updateObstacle,
  deleteObstacle,
  reorderObstacles,
  createWallSection,
  listWallSections,
  updateWallSection,
  deleteWallSection,
  reorderWallSections,
} from './geometry.advanced.controller.js';

/**
 * Маршруты геометрии комнат.
 * Обработчики вынесены в geometry.controller.ts (openings/subsections/works)
 * и geometry.advanced.controller.ts (segments/obstacles/wall-sections).
 * Zod-схемы — существующие в middleware/validation.js. Контракт HTTP не изменён.
 */
const router = Router();

router.use(authenticate);

// ─── OPENINGS (Windows & Doors) ──────────────────────────────

// POST /api/rooms/:roomId/openings - Create opening
router.post('/rooms/:roomId/openings', createOpening);

// GET /api/rooms/:roomId/openings - List openings
router.get('/rooms/:roomId/openings', listOpenings);

// PUT /api/openings/:id - Update opening
router.put('/openings/:id', updateOpening);

// DELETE /api/openings/:id - Delete opening
router.delete('/openings/:id', deleteOpening);

// PUT /api/rooms/:roomId/openings/order - Reorder openings
router.put('/rooms/:roomId/openings/order', reorderOpenings);

// ─── SUBSECTIONS (Extended Mode) ─────────────────────────────

// POST /api/rooms/:roomId/subsections - Create subsection
router.post('/rooms/:roomId/subsections', createSubSection);

// GET /api/rooms/:roomId/subsections - List subsections
router.get('/rooms/:roomId/subsections', listSubSections);

// PUT /api/subsections/:id - Update subsection
router.put('/subsections/:id', updateSubSection);

// DELETE /api/subsections/:id - Delete subsection
router.delete('/subsections/:id', deleteSubSection);

// PUT /api/rooms/:roomId/subsections/order - Reorder subsections
router.put('/rooms/:roomId/subsections/order', reorderSubSections);

// ─── SEGMENTS (Advanced Mode) ────────────────────────────────

// POST /api/rooms/:roomId/segments - Create segment
router.post('/rooms/:roomId/segments', createSegment);

// GET /api/rooms/:roomId/segments - List segments
router.get('/rooms/:roomId/segments', listSegments);

// PUT /api/segments/:id - Update segment
router.put('/segments/:id', updateSegment);

// DELETE /api/segments/:id - Delete segment
router.delete('/segments/:id', deleteSegment);

// PUT /api/rooms/:roomId/segments/order - Reorder segments
router.put('/rooms/:roomId/segments/order', reorderSegments);

// ─── OBSTACLES (Advanced Mode) ───────────────────────────────

// POST /api/rooms/:roomId/obstacles - Create obstacle
router.post('/rooms/:roomId/obstacles', createObstacle);

// GET /api/rooms/:roomId/obstacles - List obstacles
router.get('/rooms/:roomId/obstacles', listObstacles);

// PUT /api/obstacles/:id - Update obstacle
router.put('/obstacles/:id', updateObstacle);

// DELETE /api/obstacles/:id - Delete obstacle
router.delete('/obstacles/:id', deleteObstacle);

// PUT /api/rooms/:roomId/obstacles/order - Reorder obstacles
router.put('/rooms/:roomId/obstacles/order', reorderObstacles);

// ─── WALL SECTIONS (Advanced Mode) ───────────────────────────

// POST /api/rooms/:roomId/wall-sections - Create wall section
router.post('/rooms/:roomId/wall-sections', createWallSection);

// GET /api/rooms/:roomId/wall-sections - List wall sections
router.get('/rooms/:roomId/wall-sections', listWallSections);

// PUT /api/wall-sections/:id - Update wall section
router.put('/wall-sections/:id', updateWallSection);

// DELETE /api/wall-sections/:id - Delete wall section
router.delete('/wall-sections/:id', deleteWallSection);

// PUT /api/rooms/:roomId/wall-sections/order - Reorder wall sections
router.put('/rooms/:roomId/wall-sections/order', reorderWallSections);

// ─── WORKS REORDER ──────────────────────────────────────────

// PUT /api/rooms/:roomId/works/order - Reorder works
router.put('/rooms/:roomId/works/order', reorderWorks);

export default router;
