import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createWorkSchema, updateWorkSchema, createMaterialSchema, updateMaterialSchema, createToolSchema, updateToolSchema, idParamSchema, roomIdParamSchema, workIdParamSchema } from '../middleware/validation.js';
import { WorkRepository, MaterialRepository, ToolRepository } from '../db/repositories/work.repo.js';
import { RoomRepository } from '../db/repositories/room.repo.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound, forbidden } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

router.use(authenticate);

// ═══════════════════════════════════════════════════════
// WORKS
// ═══════════════════════════════════════════════════════

// POST /api/rooms/:roomId/works - Create work
router.post('/rooms/:roomId/works', async (req: AuthRequest, res, next) => {
  try {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const data = createWorkSchema.parse(req.body);
    
    // Check room access
    const room = await RoomRepository.findById(roomId);
    if (!room) {
      throw notFound('Room not found');
    }
    
    const project = await ProjectRepository.findByIdAndUserId(room.project_id, req.user!.id);
    if (!project) {
      throw notFound('Room not found');
    }
    
    const work = await WorkRepository.create(roomId, data);
    
    res.status(201).json({
      status: 'success',
      data: work,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/works/:id - Update work
router.put('/works/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateWorkSchema.parse(req.body);
    
    const existing = await WorkRepository.findById(id);
    if (!existing) {
      throw notFound('Work not found');
    }
    
    const room = await RoomRepository.findById(existing.room_id);
    if (!room) {
      throw notFound('Work not found');
    }
    
    const project = await ProjectRepository.findByIdAndUserId(room.project_id, req.user!.id);
    if (!project) {
      throw notFound('Work not found');
    }
    
    // Check for version in the parsed data
    const inputVersion = 'version' in data ? data.version : undefined;
    if (inputVersion !== undefined && inputVersion !== existing.version) {
      throw forbidden('Version conflict');
    }
    
    const work = await WorkRepository.update(id, {
      ...data,
      version: existing.version + 1,
    });
    
    res.json({
      status: 'success',
      data: work,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/works/:id - Delete work
router.delete('/works/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await WorkRepository.findById(id);
    if (!existing) {
      throw notFound('Work not found');
    }
    
    const room = await RoomRepository.findById(existing.room_id);
    if (!room) {
      throw notFound('Work not found');
    }
    
    const project = await ProjectRepository.findByIdAndUserId(room.project_id, req.user!.id);
    if (!project) {
      throw notFound('Work not found');
    }
    
    await WorkRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Work deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════

// POST /api/works/:workId/materials - Create material
router.post('/works/:workId/materials', async (req: AuthRequest, res, next) => {
  try {
    const { workId } = workIdParamSchema.parse(req.params);
    const data = createMaterialSchema.parse(req.body);
    
    await checkWorkAccess(workId, req.user!.id);
    
    const material = await MaterialRepository.create(workId, data);
    
    res.status(201).json({
      status: 'success',
      data: material,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/materials/:id - Update material
router.put('/materials/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateMaterialSchema.parse(req.body);
    
    const existing = await MaterialRepository.findById(id);
    if (!existing) {
      throw notFound('Material not found');
    }
    
    await checkWorkAccess(existing.work_id, req.user!.id);
    
    const material = await MaterialRepository.update(id, data);
    
    res.json({
      status: 'success',
      data: material,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/materials/:id - Delete material
router.delete('/materials/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await MaterialRepository.findById(id);
    if (!existing) {
      throw notFound('Material not found');
    }
    
    await checkWorkAccess(existing.work_id, req.user!.id);
    
    await MaterialRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Material deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════

// POST /api/works/:workId/tools - Create tool
router.post('/works/:workId/tools', async (req: AuthRequest, res, next) => {
  try {
    const { workId } = workIdParamSchema.parse(req.params);
    const data = createToolSchema.parse(req.body);
    
    await checkWorkAccess(workId, req.user!.id);
    
    const tool = await ToolRepository.create(workId, data);
    
    res.status(201).json({
      status: 'success',
      data: tool,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/:id - Update tool
router.put('/tools/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateToolSchema.parse(req.body);
    
    const existing = await ToolRepository.findById(id);
    if (!existing) {
      throw notFound('Tool not found');
    }
    
    await checkWorkAccess(existing.work_id, req.user!.id);
    
    const tool = await ToolRepository.update(id, data);
    
    res.json({
      status: 'success',
      data: tool,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tools/:id - Delete tool
router.delete('/tools/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const existing = await ToolRepository.findById(id);
    if (!existing) {
      throw notFound('Tool not found');
    }
    
    await checkWorkAccess(existing.work_id, req.user!.id);
    
    await ToolRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Tool deleted',
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to check work access
async function checkWorkAccess(workId: string, userId: string) {
  const work = await WorkRepository.findById(workId);
  if (!work) {
    throw notFound('Work not found');
  }
  
  const room = await RoomRepository.findById(work.room_id);
  if (!room) {
    throw notFound('Work not found');
  }
  
  const project = await ProjectRepository.findByIdAndUserId(room.project_id, userId);
  if (!project) {
    throw notFound('Work not found');
  }
  
  return work;
}

export default router;