import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { 
  createOpeningSchema, updateOpeningSchema,
  createSubSectionSchema, updateSubSectionSchema,
  createSegmentSchema, updateSegmentSchema,
  createObstacleSchema, updateObstacleSchema,
  createWallSectionSchema, updateWallSectionSchema,
  reorderOpeningsSchema, reorderSubSectionsSchema,
  reorderSegmentsSchema, reorderObstaclesSchema,
  reorderWallSectionsSchema, reorderWorksSchema,
  idParamSchema, roomIdParamSchema
} from '../middleware/validation.js';
import { 
  RoomRepository, OpeningRepository, SubSectionRepository, 
  SegmentRepository, ObstacleRepository, WallSectionRepository 
} from '../db/repositories/room.repo.js';
import { WorkRepository } from '../db/repositories/work.repo.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound, forbidden } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

router.use(authenticate);

// ═══════════════════════════════════════════════════════
// HELPER: Check room access
// ═══════════════════════════════════════════════════════

async function checkRoomAccess(roomId: string, userId: string) {
  const room = await RoomRepository.findById(roomId);
  if (!room) {
    throw notFound('Room not found');
  }
  
  const project = await ProjectRepository.findByIdAndUserId(room.project_id, userId);
  if (!project) {
    throw notFound('Room not found');
  }
  
  return room;
}

// ═══════════════════════════════════════════════════════
// OPENINGS (Windows & Doors)
// ═══════════════════════════════════════════════════════

// POST /api/rooms/:roomId/openings - Create opening
router.post('/rooms/:roomId/openings', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = createOpeningSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const opening = await OpeningRepository.create(roomId, data);
    
    res.status(201).json({
      status: 'success',
      data: opening,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:roomId/openings - List openings
router.get('/rooms/:roomId/openings', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const type = req.query.type as 'window' | 'door' | undefined;
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const openings = await OpeningRepository.findByRoomId(roomId, type);
    
    res.json({
      status: 'success',
      data: openings,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/openings/:id - Update opening
router.put('/openings/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateOpeningSchema.parse(req.body);
    
    const existing = await OpeningRepository.findById(id);
    if (!existing) {
      throw notFound('Opening not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    const opening = await OpeningRepository.update(id, data);
    
    res.json({
      status: 'success',
      data: opening,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/openings/:id - Delete opening
router.delete('/openings/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await OpeningRepository.findById(id);
    if (!existing) {
      throw notFound('Opening not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    await OpeningRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Opening deleted',
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rooms/:roomId/openings/order - Reorder openings
router.put('/rooms/:roomId/openings/order', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = reorderOpeningsSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    await OpeningRepository.reorder(roomId, data.openingIds);
    
    res.json({
      status: 'success',
      message: 'Openings reordered',
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// SUBSECTIONS (Extended Mode)
// ═══════════════════════════════════════════════════════

// POST /api/rooms/:roomId/subsections - Create subsection
router.post('/rooms/:roomId/subsections', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = createSubSectionSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const subsection = await SubSectionRepository.create(roomId, data);
    
    res.status(201).json({
      status: 'success',
      data: subsection,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:roomId/subsections - List subsections
router.get('/rooms/:roomId/subsections', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const subsections = await SubSectionRepository.findByRoomId(roomId);
    
    res.json({
      status: 'success',
      data: subsections,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/subsections/:id - Update subsection
router.put('/subsections/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateSubSectionSchema.parse(req.body);
    
    const existing = await SubSectionRepository.findById(id);
    if (!existing) {
      throw notFound('Subsection not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    // Check version conflict
    const inputVersion = 'version' in data ? data.version : undefined;
    if (inputVersion !== undefined && inputVersion !== existing.version) {
      throw forbidden('Version conflict');
    }
    
    const subsection = await SubSectionRepository.update(id, {
      ...data,
      version: existing.version + 1,
    });
    
    res.json({
      status: 'success',
      data: subsection,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/subsections/:id - Delete subsection
router.delete('/subsections/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await SubSectionRepository.findById(id);
    if (!existing) {
      throw notFound('Subsection not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    await SubSectionRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Subsection deleted',
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rooms/:roomId/subsections/order - Reorder subsections
router.put('/rooms/:roomId/subsections/order', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = reorderSubSectionsSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    await SubSectionRepository.reorder(roomId, data.subsectionIds);
    
    res.json({
      status: 'success',
      message: 'Subsections reordered',
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// SEGMENTS (Advanced Mode)
// ═══════════════════════════════════════════════════════

// POST /api/rooms/:roomId/segments - Create segment
router.post('/rooms/:roomId/segments', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = createSegmentSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const segment = await SegmentRepository.create(roomId, data);
    
    res.status(201).json({
      status: 'success',
      data: segment,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:roomId/segments - List segments
router.get('/rooms/:roomId/segments', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const segments = await SegmentRepository.findByRoomId(roomId);
    
    res.json({
      status: 'success',
      data: segments,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/segments/:id - Update segment
router.put('/segments/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateSegmentSchema.parse(req.body);
    
    const existing = await SegmentRepository.findById(id);
    if (!existing) {
      throw notFound('Segment not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    const inputVersion = 'version' in data ? data.version : undefined;
    if (inputVersion !== undefined && inputVersion !== existing.version) {
      throw forbidden('Version conflict');
    }
    
    const segment = await SegmentRepository.update(id, {
      ...data,
      version: existing.version + 1,
    });
    
    res.json({
      status: 'success',
      data: segment,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/segments/:id - Delete segment
router.delete('/segments/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await SegmentRepository.findById(id);
    if (!existing) {
      throw notFound('Segment not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    await SegmentRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Segment deleted',
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rooms/:roomId/segments/order - Reorder segments
router.put('/rooms/:roomId/segments/order', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = reorderSegmentsSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    await SegmentRepository.reorder(roomId, data.segmentIds);
    
    res.json({
      status: 'success',
      message: 'Segments reordered',
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// OBSTACLES (Advanced Mode)
// ═══════════════════════════════════════════════════════

// POST /api/rooms/:roomId/obstacles - Create obstacle
router.post('/rooms/:roomId/obstacles', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = createObstacleSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const obstacle = await ObstacleRepository.create(roomId, data);
    
    res.status(201).json({
      status: 'success',
      data: obstacle,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:roomId/obstacles - List obstacles
router.get('/rooms/:roomId/obstacles', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const obstacles = await ObstacleRepository.findByRoomId(roomId);
    
    res.json({
      status: 'success',
      data: obstacles,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/obstacles/:id - Update obstacle
router.put('/obstacles/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateObstacleSchema.parse(req.body);
    
    const existing = await ObstacleRepository.findById(id);
    if (!existing) {
      throw notFound('Obstacle not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    const inputVersion = 'version' in data ? data.version : undefined;
    if (inputVersion !== undefined && inputVersion !== existing.version) {
      throw forbidden('Version conflict');
    }
    
    const obstacle = await ObstacleRepository.update(id, {
      ...data,
      version: existing.version + 1,
    });
    
    res.json({
      status: 'success',
      data: obstacle,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/obstacles/:id - Delete obstacle
router.delete('/obstacles/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await ObstacleRepository.findById(id);
    if (!existing) {
      throw notFound('Obstacle not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    await ObstacleRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Obstacle deleted',
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rooms/:roomId/obstacles/order - Reorder obstacles
router.put('/rooms/:roomId/obstacles/order', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = reorderObstaclesSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    await ObstacleRepository.reorder(roomId, data.obstacleIds);
    
    res.json({
      status: 'success',
      message: 'Obstacles reordered',
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// WALL SECTIONS (Advanced Mode)
// ═══════════════════════════════════════════════════════

// POST /api/rooms/:roomId/wall-sections - Create wall section
router.post('/rooms/:roomId/wall-sections', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = createWallSectionSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const wallSection = await WallSectionRepository.create(roomId, data);
    
    res.status(201).json({
      status: 'success',
      data: wallSection,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:roomId/wall-sections - List wall sections
router.get('/rooms/:roomId/wall-sections', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    const wallSections = await WallSectionRepository.findByRoomId(roomId);
    
    res.json({
      status: 'success',
      data: wallSections,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/wall-sections/:id - Update wall section
router.put('/wall-sections/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateWallSectionSchema.parse(req.body);
    
    const existing = await WallSectionRepository.findById(id);
    if (!existing) {
      throw notFound('Wall section not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    const inputVersion = 'version' in data ? data.version : undefined;
    if (inputVersion !== undefined && inputVersion !== existing.version) {
      throw forbidden('Version conflict');
    }
    
    const wallSection = await WallSectionRepository.update(id, {
      ...data,
      version: existing.version + 1,
    });
    
    res.json({
      status: 'success',
      data: wallSection,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/wall-sections/:id - Delete wall section
router.delete('/wall-sections/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await WallSectionRepository.findById(id);
    if (!existing) {
      throw notFound('Wall section not found');
    }
    
    await checkRoomAccess(existing.room_id, req.user!.id);
    
    await WallSectionRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Wall section deleted',
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rooms/:roomId/wall-sections/order - Reorder wall sections
router.put('/rooms/:roomId/wall-sections/order', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = reorderWallSectionsSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    await WallSectionRepository.reorder(roomId, data.wallSectionIds);
    
    res.json({
      status: 'success',
      message: 'Wall sections reordered',
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// WORKS REORDER
// ═══════════════════════════════════════════════════════

// PUT /api/rooms/:roomId/works/order - Reorder works
router.put('/rooms/:roomId/works/order', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = reorderWorksSchema.parse(req.body);
    
    await checkRoomAccess(roomId, req.user!.id);
    
    await WorkRepository.reorder(roomId, data.workIds);
    
    res.json({
      status: 'success',
      message: 'Works reordered',
    });
  } catch (error) {
    next(error);
  }
});

export default router;