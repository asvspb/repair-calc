import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createRoomSchema, updateRoomSchema, reorderRoomsSchema, idParamSchema, projectIdParamSchema } from '../middleware/validation.js';
import { RoomRepository } from '../db/repositories/room.repo.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound, forbidden } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

router.use(authenticate);

// POST /api/projects/:projectId/rooms - Create room
router.post('/projects/:projectId/rooms', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const data = createRoomSchema.parse(req.body);
    
    const project = await ProjectRepository.findByIdAndUserId(projectId, req.user!.id);
    if (!project) {
      throw notFound('Project not found');
    }
    
    const room = await RoomRepository.create(projectId, data);
    
    res.status(201).json({
      status: 'success',
      data: room,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:id - Get room with all data
router.get('/rooms/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const room = await RoomRepository.findFullRoom(id);
    if (!room) {
      throw notFound('Room not found');
    }
    
    const project = await ProjectRepository.findByIdAndUserId(room.project_id, req.user!.id);
    if (!project) {
      throw notFound('Room not found');
    }
    
    res.json({
      status: 'success',
      data: room,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rooms/:id - Update room
router.put('/rooms/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateRoomSchema.parse(req.body);
    
    const existing = await RoomRepository.findById(id);
    if (!existing) {
      throw notFound('Room not found');
    }
    
    const project = await ProjectRepository.findByIdAndUserId(existing.project_id, req.user!.id);
    if (!project) {
      throw notFound('Room not found');
    }
    
    if (data.version && data.version !== existing.version) {
      throw forbidden('Version conflict - room has been modified');
    }
    
    const room = await RoomRepository.update(id, {
      ...data,
      version: existing.version + 1,
    });
    
    res.json({
      status: 'success',
      data: room,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/rooms/:id - Delete room
router.delete('/rooms/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await RoomRepository.findById(id);
    if (!existing) {
      throw notFound('Room not found');
    }
    
    const project = await ProjectRepository.findByIdAndUserId(existing.project_id, req.user!.id);
    if (!project) {
      throw notFound('Room not found');
    }
    
    await RoomRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Room deleted',
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:projectId/rooms/order - Reorder rooms
router.put('/projects/:projectId/rooms/order', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const data = reorderRoomsSchema.parse(req.body);
    
    const project = await ProjectRepository.findByIdAndUserId(projectId, req.user!.id);
    if (!project) {
      throw notFound('Project not found');
    }
    
    await RoomRepository.reorder(projectId, data.roomIds);
    
    res.json({
      status: 'success',
      message: 'Rooms reordered',
    });
  } catch (error) {
    next(error);
  }
});

export default router;