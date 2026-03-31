import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createProjectSchema, updateProjectSchema, idParamSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound, forbidden } from '../middleware/errorHandler.js';
import type { AuthRequest, Project, Room } from '../types/index.js';

const router = Router();

// Middleware для детального логирования
router.use((req, res, next) => {
  const userId = (req as AuthRequest).user?.id || 'ANONYMOUS';
  const timestamp = new Date().toISOString();
  
  console.log('\n' + '='.repeat(60));
  console.log(`📡 [${timestamp}] PROJECTS API`);
  console.log('='.repeat(60));
  console.log(`   Метод: ${req.method}`);
  console.log(`   Путь: ${req.path}`);
  console.log(`   Пользователь: ${userId}`);
  
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const bodyStr = JSON.stringify(req.body, null, 2);
    console.log(`   Тело: ${bodyStr.substring(0, 500)}${bodyStr.length > 500 ? '...' : ''}`);
  }
  
  next();
});

// All routes require authentication
router.use(authenticate);

// GET /api/projects - List all projects for user
router.get('/', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const projects = await ProjectRepository.findByUserId(req.user!.id);
    
    console.log(`\n📋 [GET /projects] Список проектов`);
    console.log(`   Найдено: ${projects.length}`);
    projects.forEach(p => {
      console.log(`   • ${p.name} (${p.city || 'без города'})`);
    });
    
    console.log(`\n✅ Завершено за ${Date.now() - startTime}ms`);
    
    res.json({
      status: 'success',
      data: projects,
    });
  } catch (error) {
    console.log(`\n❌ [GET /projects] Ошибка за ${Date.now() - startTime}ms:`, error);
    next(error);
  }
});

// POST /api/projects - Create new project
router.post('/', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await ProjectRepository.create(req.user!.id, data);

    console.log(`\n✅ [POST /projects] Создан проект`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Название: "${project.name}"`);
    console.log(`   Город: ${project.city || 'не указан'}`);
    console.log(`   Завершено за ${Date.now() - startTime}ms`);

    res.status(201).json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    console.log(`\n❌ [POST /projects] Ошибка за ${Date.now() - startTime}ms:`, error);
    next(error);
  }
});

// GET /api/projects/:id - Get single project with rooms
router.get('/:id', async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const { id } = idParamSchema.parse(req.params);

    const project = await ProjectRepository.findFullProject(id, req.user!.id);
    if (!project) {
      console.log(`\n⚠️ [GET /projects/:id] Проект не найден: ${id}`);
      throw notFound('Project not found');
    }

    console.log(`\n📋 [GET /projects/:id] Проект с комнатами`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Название: "${project.name}"`);
    console.log(`   Город: ${project.city || 'не указан'}`);
    console.log(`   Комнат: ${project.rooms?.length || 0}`);
    
    if (project.rooms && project.rooms.length > 0) {
      project.rooms.forEach(r => {
        const works = typeof r.works === 'string' ? JSON.parse(r.works) : r.works;
        const worksArray = Array.isArray(works) ? works : [];
        console.log(`   • ${r.name}: ${r.length}×${r.width}×${r.height}, работ: ${worksArray.filter(w => w.enabled).length}`);
      });
    }
    console.log(`   Завершено за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    console.log(`\n❌ [GET /projects/:id] Ошибка за ${Date.now() - startTime}ms:`, error);
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
      console.log(`\n⚠️ [PUT /projects/:id] Проект не найден: ${id}`);
      throw notFound('Project not found');
    }

    // Optimistic locking
    if (data.version && data.version !== existing.version) {
      console.log(`\n⚠️ [PUT /projects/:id] Конфликт версий`);
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

    console.log(`\n✅ [PUT /projects/:id] Проект обновлён`);
    if (project) {
      console.log(`   ID: ${project.id}`);
      console.log(`   Название: "${project.name}"`);
      console.log(`   Версия: ${project.version}`);
    }
    console.log(`   Завершено за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    console.log(`\n❌ [PUT /projects/:id] Ошибка за ${Date.now() - startTime}ms:`, error);
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
      console.log(`\n⚠️ [DELETE /projects/:id] Проект не найден: ${id}`);
      throw notFound('Project not found');
    }

    console.log(`\n🗑️ [DELETE /projects/:id] Удаление проекта`);
    console.log(`   ID: ${id}`);
    console.log(`   Название: "${existing.name}"`);

    await ProjectRepository.delete(id);

    console.log(`   ✅ Удалён за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      message: 'Project deleted',
    });
  } catch (error) {
    console.log(`\n❌ [DELETE /projects/:id] Ошибка за ${Date.now() - startTime}ms:`, error);
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
      console.log(`\n⚠️ [PUT /projects/:id/ai-settings] Проект не найден: ${id}`);
      throw notFound('Project not found');
    }

    const project = await ProjectRepository.update(id, {
      use_ai_pricing,
      city,
      last_ai_price_update: use_ai_pricing ? new Date() : null,
    });

    console.log(`\n✅ [PUT /projects/:id/ai-settings] Настройки AI обновлены`);
    if (project) {
      console.log(`   ID: ${project.id}`);
      console.log(`   AI Pricing: ${use_ai_pricing ? 'ВКЛ' : 'ВЫКЛ'}`);
      console.log(`   Город: ${city || 'не указан'}`);
    }
    console.log(`   Завершено за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    console.log(`\n❌ [PUT /projects/:id/ai-settings] Ошибка за ${Date.now() - startTime}ms:`, error);
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
      console.log(`\n⚠️ [PUT /projects/:id/with-rooms] Проект не найден: ${id}`);
      throw notFound('Project not found');
    }

    console.log(`\n🔄 [PUT /projects/:id/with-rooms] Обновление проекта с комнатами`);
    console.log(`   ID: ${id}`);
    console.log(`   Название: "${existing.name}" → "${name || existing.name}"`);
    console.log(`   Комнат в запросе: ${rooms?.length || 0}`);
    
    if (rooms && rooms.length > 0) {
      console.log(`   ┌─ Комнаты:`);
      rooms.forEach((r: Room, i: number) => {
        const works = typeof r.works === 'string' ? JSON.parse(r.works) : r.works;
        const worksArray = Array.isArray(works) ? works : [];
        const enabledWorks = worksArray.filter((w: any) => w.enabled);
        
        console.log(`   │`);
        console.log(`   ├─ 🏠 #${i + 1}: "${r.name}"`);
        console.log(`   │   ID: ${r.id}`);
        console.log(`   │   Размеры: ${r.length}м × ${r.width}м × ${r.height}м`);
        console.log(`   │   Площадь: ${(r.length * r.width).toFixed(2)} м²`);
        console.log(`   │   Работ: ${enabledWorks.length}`);
        
        if (enabledWorks.length > 0) {
          const totalWorkCost = enabledWorks.reduce((sum: number, w: any) => {
            return sum + (w.work_unit_price * r.length * r.width);
          }, 0);
          console.log(`   │   Стоимость работ: ${totalWorkCost.toFixed(2)} руб.`);
        }
      });
      console.log(`   └─`);
    }

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

    console.log(`\n✅ [PUT /projects/:id/with-rooms] Успешно обновлено`);
    console.log(`   Завершено за ${Date.now() - startTime}ms`);

    res.json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    console.log(`\n❌ [PUT /projects/:id/with-rooms] Ошибка за ${Date.now() - startTime}ms:`, error);
    next(error);
  }
});

export default router;