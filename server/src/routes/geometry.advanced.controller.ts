import type { Response, NextFunction } from 'express';
import {
  createSegmentSchema,
  updateSegmentSchema,
  createObstacleSchema,
  updateObstacleSchema,
  createWallSectionSchema,
  updateWallSectionSchema,
  reorderSegmentsSchema,
  reorderObstaclesSchema,
  reorderWallSectionsSchema,
  idParamSchema,
  roomIdParamSchema,
} from '../middleware/validation.js';
import {
  SegmentRepository,
  ObstacleRepository,
  WallSectionRepository,
} from '../db/repositories/room.repo.js';
import { notFound, forbidden } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../types/index.js';
import { checkRoomAccess } from './geometry.controller.js';

// ═══════════════════════════════════════════════════════
// КОНТРОЛЛЕР ГЕОМЕТРИИ (ADVANCED): SEGMENTS + OBSTACLES + WALL SECTIONS
// (вынесено из geometry.ts)
// ═══════════════════════════════════════════════════════

// ─── SEGMENTS (Advanced Mode) ────────────────────────────────

export async function createSegment(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function listSegments(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function updateSegment(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function deleteSegment(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function reorderSegments(req: AuthRequest, res: Response, next: NextFunction) {
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
}

// ─── OBSTACLES (Advanced Mode) ───────────────────────────────

export async function createObstacle(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function listObstacles(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function updateObstacle(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function deleteObstacle(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function reorderObstacles(req: AuthRequest, res: Response, next: NextFunction) {
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
}

// ─── WALL SECTIONS (Advanced Mode) ───────────────────────────

export async function createWallSection(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function listWallSections(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function updateWallSection(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function deleteWallSection(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function reorderWallSections(req: AuthRequest, res: Response, next: NextFunction) {
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
}
