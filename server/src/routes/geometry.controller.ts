import type { Response, NextFunction } from 'express';
import {
  createOpeningSchema,
  updateOpeningSchema,
  createSubSectionSchema,
  updateSubSectionSchema,
  reorderOpeningsSchema,
  reorderSubSectionsSchema,
  reorderWorksSchema,
  idParamSchema,
  roomIdParamSchema,
} from '../middleware/validation.js';
import {
  RoomRepository,
  OpeningRepository,
  SubSectionRepository,
} from '../db/repositories/room.repo.js';
import { WorkRepository } from '../db/repositories/work.repo.js';
import { ObjectRepository } from '../db/repositories/object.repo.js';
import { notFound, forbidden } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../types/index.js';

// ═══════════════════════════════════════════════════════
// КОНТРОЛЛЕР ГЕОМЕТРИИ: OPENINGS + SUBSECTIONS + WORKS ORDER
// (вынесено из geometry.ts; advanced-сущности — geometry.advanced.controller.ts)
// ═══════════════════════════════════════════════════════

/** Проверка доступа к комнате. */
export async function checkRoomAccess(roomId: string, userId: string) {
  const room = await RoomRepository.findByIdWithObject(roomId);
  if (!room) {
    throw notFound('Room not found');
  }

  const object = await ObjectRepository.findByIdAndUserId(room.object_id, userId);
  if (!object) {
    throw notFound('Room not found');
  }

  return room;
}

// ─── OPENINGS (Windows & Doors) ──────────────────────────────

export async function createOpening(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function listOpenings(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function updateOpening(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function deleteOpening(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function reorderOpenings(req: AuthRequest, res: Response, next: NextFunction) {
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
}

// ─── SUBSECTIONS (Extended Mode) ─────────────────────────────

export async function createSubSection(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function listSubSections(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function updateSubSection(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function deleteSubSection(req: AuthRequest, res: Response, next: NextFunction) {
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
}

export async function reorderSubSections(req: AuthRequest, res: Response, next: NextFunction) {
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
}

// ─── WORKS REORDER ──────────────────────────────────────────

export async function reorderWorks(req: AuthRequest, res: Response, next: NextFunction) {
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
}
