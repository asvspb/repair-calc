import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createProjectSchema, updateProjectSchema, idParamSchema, updateProjectWithObjectsSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound, forbidden } from '../middleware/errorHandler.js';
import { winstonLogger } from '../middleware/logger.js';
import type { AuthRequest, Project, Room } from '../types/index.js';

const router = Router();

// Middleware для детального логирования
router.use((req, res, next) => {
  const userId = (req as AuthRequest).user?.id || 'ANONYMOUS';
  
  winstonLogger.info(`PROJECTS API ${req.method} ${req.path}`, {
    userId,
    body: req.method !== 'GET' && req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body).substring(0, 500)
      : undefined,
  });
  
  next();
});

// All routes require authentication
router.use(authenticate);

// GET /api/projects - List all projects for user
router.get('/', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const projects = await ProjectRepository.findByUserId(req.user!.id);
    
    winstonLogger.info('[GET /projects] Found projects', {
      count: projects.length,
      duration: Date.now() - startTime,
    });
    
    res.json({
      status: 'success',
      data: projects,
    });
  } catch (error) {
    winstonLogger.error('[GET /projects] Error', { duration: Date.now() - startTime, error });
    next(error);
  }
});

// POST /api/projects - Create new project
router.post('/', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    // Детальное логирование входящего запроса
    winstonLogger.info('[POST /projects] Incoming request', {
      userId: req.user?.id,
      bodyKeys: Object.keys(req.body || {}).join(', ') || 'EMPTY',
    });

    const data = createProjectSchema.parse(req.body);
    const project = await ProjectRepository.create(req.user!.id, data);

    winstonLogger.info('[POST /projects] Created project', {
      projectId: project.id,
      name: project.name,
      city: project.city || null,
      duration: Date.now() - startTime,
    });

    res.status(201).json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    winstonLogger.error('[POST /projects] Error', { duration: Date.now() - startTime, error });
    next(error);
  }
});

// GET /api/projects/:id - Get single project with objects
router.get('/:id', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const { id } = idParamSchema.parse(req.params);

    const project = await ProjectRepository.findByIdWithObjects(id, req.user!.id);
    if (!project) {
      winstonLogger.warn('[GET /projects/:id] Project not found', { projectId: id });
      throw notFound('Project not found');
    }

    winstonLogger.info('[GET /projects/:id] Project with objects', {
      projectId: project.id,
      name: project.name,
      objectsCount: project.objects?.length || 0,
      duration: Date.now() - startTime,
    });

    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    winstonLogger.error('[GET /projects/:id] Error', { duration: Date.now() - startTime, error });
    next(error);
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateProjectSchema.parse(req.body);

    // Check ownership
    const existing = await ProjectRepository.findByIdAndUserId(id, req.user!.id);
    if (!existing) {
      winstonLogger.warn('[PUT /projects/:id] Project not found', { projectId: id });
      throw notFound('Project not found');
    }

    // Optimistic locking
    if (data.version && data.version !== existing.version) {
      winstonLogger.warn('[PUT /projects/:id] Version conflict', { projectId: id });
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

    winstonLogger.info('[PUT /projects/:id] Project updated', {
      projectId: project?.id,
      version: project?.version,
      duration: Date.now() - startTime,
    });

    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    winstonLogger.error('[PUT /projects/:id] Error', { duration: Date.now() - startTime, error });
    next(error);
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const { id } = idParamSchema.parse(req.params);

    // Check ownership
    const existing = await ProjectRepository.findByIdAndUserId(id, req.user!.id);
    if (!existing) {
      winstonLogger.warn('[DELETE /projects/:id] Project not found', { projectId: id });
      throw notFound('Project not found');
    }

    await ProjectRepository.delete(id);

    winstonLogger.info('[DELETE /projects/:id] Deleted', { projectId: id, name: existing.name, duration: Date.now() - startTime });

    res.json({
      status: 'success',
      message: 'Project deleted',
    });
  } catch (error) {
    winstonLogger.error('[DELETE /projects/:id] Error', { duration: Date.now() - startTime, error });
    next(error);
  }
});

// PUT /api/projects/:id/ai-settings - Update AI settings
router.put('/:id/ai-settings', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const { id } = idParamSchema.parse(req.params);
    const { use_ai_pricing, city } = req.body;

    const existing = await ProjectRepository.findByIdAndUserId(id, req.user!.id);
    if (!existing) {
      winstonLogger.warn('[PUT /projects/:id/ai-settings] Project not found', { projectId: id });
      throw notFound('Project not found');
    }

    const project = await ProjectRepository.update(id, {
      use_ai_pricing,
      city,
      last_ai_price_update: use_ai_pricing ? new Date() : null,
    });

    winstonLogger.info('[PUT /projects/:id/ai-settings] AI settings updated', {
      projectId: project?.id,
      aiPricing: use_ai_pricing,
      city: city || null,
      duration: Date.now() - startTime,
    });

    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    winstonLogger.error('[PUT /projects/:id/ai-settings] Error', { duration: Date.now() - startTime, error });
    next(error);
  }
});

// PUT /api/projects/:id/with-rooms - Update project and rooms in a single transaction
router.put('/:id/with-rooms', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const { id } = idParamSchema.parse(req.params);
    const { name, city, use_ai_pricing, last_ai_price_update, rooms } = req.body;

    // Check ownership
    const existing = await ProjectRepository.findByIdAndUserId(id, req.user!.id);
    if (!existing) {
      winstonLogger.warn('[PUT /projects/:id/with-rooms] Project not found', { projectId: id });
      throw notFound('Project not found');
    }

    winstonLogger.info('[PUT /projects/:id/with-rooms] Updating project with rooms', {
      projectId: id,
      name: name || existing.name,
      roomsCount: rooms?.length || 0,
    });

    const projectData: Partial<Project> = {};
    if (name !== undefined) projectData.name = name;
    if (city !== undefined) projectData.city = city;
    if (use_ai_pricing !== undefined) projectData.use_ai_pricing = use_ai_pricing;
    if (last_ai_price_update !== undefined) {
      projectData.last_ai_price_update = last_ai_price_update ? new Date(last_ai_price_update) : null;
    }

    const updated = await ProjectRepository.updateWithRooms(
      id,
      req.user!.id,
      projectData,
      rooms || []
    );

    winstonLogger.info('[PUT /projects/:id/with-rooms] Updated', { duration: Date.now() - startTime });

    res.json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    winstonLogger.error('[PUT /projects/:id/with-rooms] Error', { duration: Date.now() - startTime, error });
    next(error);
  }
});

// PUT /api/projects/:id/with-objects - Update project with multiple objects
router.put('/:id/with-objects', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const { id } = idParamSchema.parse(req.params);
    const { name, city, use_ai_pricing, last_ai_price_update, objects } = updateProjectWithObjectsSchema.parse(req.body);

    // Check ownership
    const existing = await ProjectRepository.findByIdAndUserId(id, req.user!.id);
    if (!existing) {
      winstonLogger.warn('[PUT /projects/:id/with-objects] Project not found', { projectId: id });
      throw notFound('Project not found');
    }

    winstonLogger.info('[PUT /projects/:id/with-objects] Updating project with objects', {
      projectId: id,
      name: name || existing.name,
      objectsCount: objects?.length || 0,
    });

    const projectData: Partial<Project> = {};
    if (name !== undefined) projectData.name = name;
    if (city !== undefined) projectData.city = city;
    if (use_ai_pricing !== undefined) projectData.use_ai_pricing = use_ai_pricing;
    if (last_ai_price_update !== undefined) {
      projectData.last_ai_price_update = last_ai_price_update ? new Date(last_ai_price_update) : null;
    }

    const updated = await ProjectRepository.updateWithObjects(
      id,
      req.user!.id,
      projectData,
      objects || []
    );

    winstonLogger.info('[PUT /projects/:id/with-objects] Updated', { duration: Date.now() - startTime });

    res.json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    winstonLogger.error('[PUT /projects/:id/with-objects] Error', { duration: Date.now() - startTime, error });
    next(error);
  }
});

export default router;