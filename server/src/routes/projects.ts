import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createProjectSchema, updateProjectSchema, idParamSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound, forbidden } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/projects - List all projects for user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const projects = await ProjectRepository.findByUserId(req.user!.id);
    res.json({
      status: 'success',
      data: projects,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects - Create new project
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await ProjectRepository.create(req.user!.id, data);
    
    res.status(201).json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id - Get single project with rooms
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    const project = await ProjectRepository.findFullProject(id, req.user!.id);
    if (!project) {
      throw notFound('Project not found');
    }
    
    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateProjectSchema.parse(req.body);
    
    // Check ownership
    const existing = await ProjectRepository.findByIdAndUserId(id, req.user!.id);
    if (!existing) {
      throw notFound('Project not found');
    }
    
    // Optimistic locking
    if (data.version && data.version !== existing.version) {
      throw forbidden('Version conflict - project has been modified');
    }
    
    // Convert last_ai_price_update from string to Date if present
    const updateData: {
      name?: string;
      city?: string | null;
      use_ai_pricing?: boolean;
      last_ai_price_update?: Date | null;
      version: number;
    } = {
      version: existing.version + 1,
    };
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.use_ai_pricing !== undefined) updateData.use_ai_pricing = data.use_ai_pricing;
    if (data.last_ai_price_update !== undefined) {
      updateData.last_ai_price_update = data.last_ai_price_update 
        ? new Date(data.last_ai_price_update) 
        : null;
    }
    
    const project = await ProjectRepository.update(id, updateData);
    
    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    // Check ownership
    const existing = await ProjectRepository.findByIdAndUserId(id, req.user!.id);
    if (!existing) {
      throw notFound('Project not found');
    }
    
    await ProjectRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Project deleted',
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:id/ai-settings - Update AI settings
router.put('/:id/ai-settings', async (req: AuthRequest, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { use_ai_pricing, city } = req.body;
    
    const existing = await ProjectRepository.findByIdAndUserId(id, req.user!.id);
    if (!existing) {
      throw notFound('Project not found');
    }
    
    const project = await ProjectRepository.update(id, {
      use_ai_pricing,
      city,
      last_ai_price_update: use_ai_pricing ? new Date() : null,
    });
    
    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

export default router;