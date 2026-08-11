/**
 * Integration tests for route mounting in src/routes/index.ts
 *
 * Регрессия: objectsRoutes и worksRoutes объявляют полные пути внутри себя
 * (`/objects`, `/projects/:projectId/objects`, `/rooms/:roomId/works`, ...),
 * но монтировались с префиксом (`router.use('/objects', ...)`), из-за чего
 * реальные URL дублировали префикс: `/api/objects/objects`, `/api/works/rooms/:id/works`.
 *
 * Тесты специально ходят через НАСТОЯЩИЙ агрегирующий роутер (`src/routes/index.ts`),
 * а не монтируют под-роутер напрямую — иначе баг воспроизводился бы и тест бы «зеленел».
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const TEST_USER_ID = 'test-user-id';
const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_ID = '22222222-2222-4222-8222-222222222222';

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

vi.mock('../../src/db/repositories/object.repo.js', () => ({
  ObjectRepository: {
    findByUserId: vi.fn(),
    findByIdAndUserId: vi.fn(),
    findByIdWithRooms: vi.fn(),
    findByProjectId: vi.fn(),
    findProjectWithObjects: vi.fn(),
    isLimitReached: vi.fn(),
    countByProjectId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// POST /projects/:projectId/objects проверяет проект через ProjectRepository —
// без этого мока в тест попадает реальный knex-репозиторий и запрос в БД.
vi.mock('../../src/db/repositories/project.repo.js', () => ({
  ProjectRepository: {
    findByIdAndUserId: vi.fn(),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/db/repositories/room.repo.js', () => ({
  RoomRepository: {
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    create: vi.fn(),
    createForObject: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    findFullRoom: vi.fn(),
    findByIdWithObject: vi.fn(),
  },
  RoomOpeningRepository: { findByRoomId: vi.fn() },
  RoomSubSectionRepository: { findByRoomId: vi.fn() },
  RoomSegmentRepository: { findByRoomId: vi.fn() },
  RoomObstacleRepository: { findByRoomId: vi.fn() },
  RoomWallSectionRepository: { findByRoomId: vi.fn() },
}));

vi.mock('../../src/db/repositories/work.repo.js', () => ({
  WorkRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByRoomId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
  },
  MaterialRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByWorkId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  ToolRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByWorkId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { ObjectRepository } from '../../src/db/repositories/object.repo.js';
import { ProjectRepository } from '../../src/db/repositories/project.repo.js';
import { RoomRepository } from '../../src/db/repositories/room.repo.js';
import { WorkRepository } from '../../src/db/repositories/work.repo.js';
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

describe('Route mounting (src/routes/index.ts)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('GET /api/objects', () => {
    it('resolves at the documented path and returns the user objects', async () => {
      const objects = [
        { id: OBJECT_ID, project_id: 'project-1', user_id: TEST_USER_ID, name: 'Квартира' },
      ];
      vi.mocked(ObjectRepository.findByUserId).mockResolvedValue(
        objects as unknown as Awaited<ReturnType<typeof ObjectRepository.findByUserId>>,
      );

      const response = await request(app).get('/api/objects');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(objects);
      expect(ObjectRepository.findByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('does NOT respond on the double-prefixed path /api/objects/objects', async () => {
      // Регрессия: раньше сюда попадал GET /objects из objectsRoutes.
      // Теперь это должно трактоваться как /objects/:id (id не UUID -> 404/400), но не как список.
      vi.mocked(ObjectRepository.findByIdAndUserId).mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof ObjectRepository.findByIdAndUserId>>,
      );

      const response = await request(app).get('/api/objects/objects');

      expect(response.status).not.toBe(200);
      expect(ObjectRepository.findByUserId).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/rooms/:roomId/works', () => {
    it('resolves at the documented path and creates a work', async () => {
      const work = {
        id: '33333333-3333-4333-8333-333333333333',
        room_id: ROOM_ID,
        name: 'Покраска стен',
      };

      vi.mocked(RoomRepository.findById).mockResolvedValue({
        id: ROOM_ID,
        object_id: OBJECT_ID,
      } as unknown as Awaited<ReturnType<typeof RoomRepository.findById>>);
      vi.mocked(ObjectRepository.findByIdAndUserId).mockResolvedValue({
        id: OBJECT_ID,
        user_id: TEST_USER_ID,
      } as unknown as Awaited<ReturnType<typeof ObjectRepository.findByIdAndUserId>>);
      vi.mocked(WorkRepository.create).mockResolvedValue(
        work as unknown as Awaited<ReturnType<typeof WorkRepository.create>>,
      );

      const response = await request(app)
        .post(`/api/rooms/${ROOM_ID}/works`)
        .send({ name: 'Покраска стен', unit: 'м2', work_unit_price: 500 });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(work);
      expect(RoomRepository.findById).toHaveBeenCalledWith(ROOM_ID);
      expect(ObjectRepository.findByIdAndUserId).toHaveBeenCalledWith(OBJECT_ID, TEST_USER_ID);
      expect(WorkRepository.create).toHaveBeenCalledWith(
        ROOM_ID,
        expect.objectContaining({ name: 'Покраска стен' }),
      );
    });

    it('returns 404 when the room does not exist', async () => {
      vi.mocked(RoomRepository.findById).mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof RoomRepository.findById>>,
      );

      const response = await request(app)
        .post(`/api/rooms/${ROOM_ID}/works`)
        .send({ name: 'Покраска стен' });

      expect(response.status).toBe(404);
      expect(WorkRepository.create).not.toHaveBeenCalled();
    });

    it('does NOT respond on the double-prefixed path /api/works/rooms/:roomId/works', async () => {
      const response = await request(app)
        .post(`/api/works/rooms/${ROOM_ID}/works`)
        .send({ name: 'Покраска стен' });

      expect(response.status).toBe(404);
      expect(WorkRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/projects/:projectId/objects', () => {
    it('resolves at the documented path and creates the object', async () => {
      const projectId = '44444444-4444-4444-8444-444444444444';
      const created = { id: OBJECT_ID, project_id: projectId, name: 'Квартира' };

      vi.mocked(ProjectRepository.findByIdAndUserId).mockResolvedValue({
        id: projectId,
        user_id: TEST_USER_ID,
      } as unknown as Awaited<ReturnType<typeof ProjectRepository.findByIdAndUserId>>);
      vi.mocked(ObjectRepository.isLimitReached).mockResolvedValue(false);
      vi.mocked(ObjectRepository.create).mockResolvedValue(
        created as unknown as Awaited<ReturnType<typeof ObjectRepository.create>>,
      );

      const response = await request(app)
        .post(`/api/projects/${projectId}/objects`)
        .send({ name: 'Квартира' });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(created);
      expect(ProjectRepository.findByIdAndUserId).toHaveBeenCalledWith(projectId, TEST_USER_ID);
      expect(ObjectRepository.create).toHaveBeenCalledWith(
        projectId,
        TEST_USER_ID,
        expect.objectContaining({ name: 'Квартира' }),
      );
    });
  });

  describe('mounted route paths', () => {
    /**
     * Прямая проверка таблицы маршрутов express: перечисляем конкретные пути,
     * которые появлялись при неверном монтировании с префиксом. Проверка по
     * «удвоенному соседнему сегменту» тут не годится: старый путь работ был
     * `/works/rooms/:roomId/works` — соседних дублей в нём нет.
     */
    it('does not register prefix-duplicated paths', () => {
      const paths = collectRoutePaths(router);

      expect(paths.length).toBeGreaterThan(0);

      expect(paths).not.toContain('/objects/objects');
      expect(paths).not.toContain('/objects/objects/:id');
      expect(paths).not.toContain('/objects/projects/:projectId/objects');
      expect(paths).not.toContain('/works/rooms/:roomId/works');
      expect(paths).not.toContain('/works/works/:id');
      expect(paths).not.toContain('/works/works/:workId/materials');
      expect(paths).not.toContain('/works/works/:workId/tools');
      expect(paths).not.toContain('/works/materials/:id');
      expect(paths).not.toContain('/works/tools/:id');
    });

    it('exposes the documented objects and works endpoints', () => {
      const paths = collectRoutePaths(router);

      expect(paths).toContain('/objects');
      expect(paths).toContain('/objects/:id');
      expect(paths).toContain('/projects/:projectId/objects');
      expect(paths).toContain('/rooms/:roomId/works');
      expect(paths).toContain('/works/:id');
      expect(paths).toContain('/works/:workId/materials');
      expect(paths).toContain('/works/:workId/tools');
      expect(paths).toContain('/materials/:id');
      expect(paths).toContain('/tools/:id');
    });
  });
});

/**
 * Обходит стек express-роутера и собирает полные пути зарегистрированных маршрутов.
 *
 * ВНИМАНИЕ: опирается на внутренности Express 4 (`layer.name === 'router'`,
 * разбор `layer.regexp.source`). При обновлении до Express 5 (path-to-regexp v8)
 * эти поля меняются — хелпер придётся адаптировать.
 */
interface RouterLayer {
  route?: { path: string | string[] };
  name?: string;
  handle?: { stack?: RouterLayer[] };
  regexp?: RegExp;
}

function collectRoutePaths(expressRouter: express.Router, prefix = ''): string[] {
  const stack = (expressRouter as unknown as { stack: RouterLayer[] }).stack ?? [];

  return stack.flatMap(layer => {
    if (layer.route) {
      const routePaths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      return routePaths.map(routePath => `${prefix}${routePath}`.replace(/\/{2,}/g, '/'));
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      return collectRoutePaths(
        layer.handle as unknown as express.Router,
        prefix + mountPath(layer),
      );
    }

    return [];
  });
}

/**
 * Восстанавливает префикс монтирования под-роутера из его regexp.
 */
function mountPath(layer: RouterLayer): string {
  const source = layer.regexp?.source;
  if (!source || source === '^\\/?(?=\\/|$)') {
    return '';
  }

  const match = /^\^\\\/([^\\?]*)/.exec(source);
  return match ? `/${match[1]}` : '';
}
