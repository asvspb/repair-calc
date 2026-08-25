/**
 * Integration tests for project archive endpoints
 * (GET /archived, PATCH /:id/restore, DELETE /:id/permanent)
 *
 * Регрессия порядка маршрутов: GET /api/projects/archived НЕ должен попадать
 * в GET /projects/:id — Express матчит маршруты в порядке регистрации, и если
 * бы '/archived' оказался после '/:id', он был бы распарсен как :id='archived'
 * и список архива стал бы недоступен (400 от Zod: не UUID).
 *
 * Тесты ходят через НАСТОЯЩИЙ агрегирующий роутер (src/routes/index.ts),
 * как и routeMounting.test.ts, а не монтируют под-роутер напрямую.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const TEST_USER_ID = 'test-user-id';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';

// Аутентификация замокана: подставляем пользователя и пропускаем дальше
vi.mock('../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: unknown }).user = {
      id: TEST_USER_ID,
      email: 'test@test.com',
      role: 'user',
    };
    next();
  },
  adminGuard: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../src/db/repositories/project.repo.js', () => ({
  ProjectRepository: {
    findByUserId: vi.fn(),
    findByIdAndUserId: vi.fn(),
    findById: vi.fn(),
    findByIdWithObjects: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findArchivedByUserId: vi.fn(),
    restore: vi.fn(),
    hardDelete: vi.fn(),
  },
}));

import { ProjectRepository } from '../../src/db/repositories/project.repo.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { router } from '../../src/routes/index.js';

/**
 * Приложение собирается так же, как в src/app.ts: агрегирующий роутер под /api.
 * Это гарантирует, что тест проверяет фактическое монтирование маршрутов.
 */
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use(errorHandler);
  return app;
};

// Полный проект с объектами/комнатами в формате ProjectWithObjects (как из findByIdWithObjects)
const buildProjectWithObjects = () => ({
  id: PROJECT_ID,
  user_id: TEST_USER_ID,
  name: 'Архивный проект',
  city: null,
  use_ai_pricing: false,
  last_ai_price_update: null,
  version: 1,
  created_at: new Date('2026-01-01T10:00:00.000Z'),
  updated_at: new Date('2026-01-02T10:00:00.000Z'),
  objects: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      project_id: PROJECT_ID,
      user_id: TEST_USER_ID,
      name: 'Квартира',
      city: null,
      address: null,
      use_ai_pricing: false,
      last_ai_price_update: null,
      version: 1,
      sort_order: 0,
      created_at: new Date('2026-01-01T10:00:00.000Z'),
      updated_at: new Date('2026-01-01T10:00:00.000Z'),
      deleted_at: null,
      rooms: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          object_id: '55555555-5555-4555-8555-555555555555',
          name: 'Гостиная',
          geometry_mode: 'simple',
          length: 5,
          width: 4,
          height: 2.7,
          version: 1,
          sort_order: 0,
          created_at: new Date('2026-01-01T10:00:00.000Z'),
          updated_at: new Date('2026-01-01T10:00:00.000Z'),
          segments: null,
          obstacles: null,
          wall_sections: null,
          sub_sections: null,
          windows: null,
          doors: null,
          works: null,
          simple_mode_data: null,
          extended_mode_data: null,
          advanced_mode_data: null,
        },
      ],
    },
  ],
});

describe('Project archive routes (src/routes/projects.ts)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('GET /api/projects/archived', () => {
    it('returns the archived projects list with counts', async () => {
      const archived = [
        {
          id: PROJECT_ID,
          user_id: TEST_USER_ID,
          name: 'Черновик',
          city: null,
          use_ai_pricing: false,
          last_ai_price_update: null,
          version: 1,
          created_at: new Date('2026-01-01T10:00:00.000Z'),
          updated_at: new Date('2026-01-02T10:00:00.000Z'),
          deleted_at: new Date('2026-01-03T10:00:00.000Z'),
          objectsCount: 2,
          roomsCount: 5,
        },
      ];
      vi.mocked(ProjectRepository.findArchivedByUserId).mockResolvedValue(
        archived as unknown as Awaited<ReturnType<typeof ProjectRepository.findArchivedByUserId>>,
      );

      const response = await request(app).get('/api/projects/archived');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(JSON.parse(JSON.stringify(archived)));
      expect(ProjectRepository.findArchivedByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('is NOT swallowed by GET /projects/:id (route order regression)', async () => {
      // Если бы /archived попал в /:id, вызвался бы findByIdWithObjects (или Zod 400),
      // но не findArchivedByUserId. Фиксируем различение по отсутствию вызова :id-хендлера.
      vi.mocked(ProjectRepository.findArchivedByUserId).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof ProjectRepository.findArchivedByUserId>>,
      );

      const response = await request(app).get('/api/projects/archived');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(ProjectRepository.findArchivedByUserId).toHaveBeenCalled();
      expect(ProjectRepository.findByIdWithObjects).not.toHaveBeenCalled();
      expect(ProjectRepository.findByUserId).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/projects/:id/restore', () => {
    it('returns the restored project with objects and rooms on success', async () => {
      const project = buildProjectWithObjects();
      vi.mocked(ProjectRepository.restore).mockResolvedValue({
        status: 'restored',
        project,
      });

      const response = await request(app).patch(`/api/projects/${PROJECT_ID}/restore`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(JSON.parse(JSON.stringify(project)));
      expect(ProjectRepository.restore).toHaveBeenCalledWith(PROJECT_ID, TEST_USER_ID);
    });

    it('returns 404 when the project does not exist', async () => {
      vi.mocked(ProjectRepository.restore).mockResolvedValue({ status: 'not_found' });

      const response = await request(app).patch(`/api/projects/${PROJECT_ID}/restore`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Project not found');
    });

    it('returns 400 when the project is not archived (nothing to restore)', async () => {
      vi.mocked(ProjectRepository.restore).mockResolvedValue({ status: 'not_archived' });

      const response = await request(app).patch(`/api/projects/${PROJECT_ID}/restore`);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Project is not archived');
    });

    it('returns 400 validation error for a non-UUID id', async () => {
      const response = await request(app).patch('/api/projects/not-an-uuid/restore');

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(ProjectRepository.restore).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/projects/:id/permanent', () => {
    it('permanently deletes the archived project and returns deleted counts', async () => {
      vi.mocked(ProjectRepository.hardDelete).mockResolvedValue({
        status: 'deleted',
        deleted: { objects: 3, rooms: 7 },
      });

      const response = await request(app).delete(`/api/projects/${PROJECT_ID}/permanent`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual({ deleted: { objects: 3, rooms: 7 } });
      expect(ProjectRepository.hardDelete).toHaveBeenCalledWith(PROJECT_ID, TEST_USER_ID);
    });

    it('returns 404 when the project does not exist', async () => {
      vi.mocked(ProjectRepository.hardDelete).mockResolvedValue({ status: 'not_found' });

      const response = await request(app).delete(`/api/projects/${PROJECT_ID}/permanent`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Project not found');
    });

    it('returns 409 when the project is active (archive it first)', async () => {
      vi.mocked(ProjectRepository.hardDelete).mockResolvedValue({ status: 'not_archived' });

      const response = await request(app).delete(`/api/projects/${PROJECT_ID}/permanent`);

      expect(response.status).toBe(409);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Archive the project first');
    });
  });
});
