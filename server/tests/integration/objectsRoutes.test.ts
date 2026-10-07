/**
 * Integration tests for /api/.../objects routes (трассировка ТЗ v1.1, пункты
 * 15.17 / 12.2 / решения №9-10): POST/PUT объектов валидируются Zod (400 с телом
 * ошибки в формате errorHandler), лимит 10 объектов отдаёт 403
 * OBJECT_LIMIT_REACHED — как в текущем коде.
 * Репозитории замоканы; ходим через настоящий роутер + errorHandler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const TEST_USER_ID = 'user-1';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_ID = '22222222-2222-4222-8222-222222222222';

vi.mock('../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: unknown }).user = {
      id: TEST_USER_ID,
      email: 'test@test.com',
      role: 'user',
    };
    next();
  },
}));

vi.mock('../../src/db/repositories/object.repo.js', () => ({
  ObjectRepository: {
    findByIdAndUserId: vi.fn(),
    isLimitReached: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findByUserId: vi.fn(),
    findByIdWithRooms: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/db/repositories/project.repo.js', () => ({
  ProjectRepository: {
    findByIdAndUserId: vi.fn(),
  },
}));

import objectsRouter from '../../src/routes/objects.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { ObjectRepository } from '../../src/db/repositories/object.repo.js';
import { ProjectRepository } from '../../src/db/repositories/project.repo.js';

const mockedObjects = ObjectRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockedProjects = ProjectRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', objectsRouter);
  app.use(errorHandler);
  return app;
}

function dbProject() {
  return { id: PROJECT_ID, user_id: TEST_USER_ID, name: 'P' };
}

function dbObject() {
  return {
    id: OBJECT_ID,
    project_id: PROJECT_ID,
    user_id: TEST_USER_ID,
    name: 'Объект',
    city: null,
    address: null,
    use_ai_pricing: false,
    last_ai_price_update: null,
    sort_order: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedProjects.findByIdAndUserId.mockResolvedValue(dbProject());
  mockedObjects.isLimitReached.mockResolvedValue(false);
});

describe('POST /api/projects/:projectId/objects — Zod-валидация (решение №9)', () => {
  it('создаёт объект при валидном теле (201)', async () => {
    mockedObjects.create.mockResolvedValue(dbObject());

    const res = await request(buildApp())
      .post(`/projects/${PROJECT_ID}/objects`)
      .send({ name: 'Объект', city: 'Москва', use_ai_pricing: true });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(mockedObjects.create).toHaveBeenCalledWith(PROJECT_ID, TEST_USER_ID, {
      name: 'Объект',
      city: 'Москва',
      address: null,
      use_ai_pricing: true,
    });
  });

  it('400 с телом ошибки, если name отсутствует', async () => {
    const res = await request(buildApp())
      .post(`/projects/${PROJECT_ID}/objects`)
      .send({ city: 'Москва' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
    );
    expect(mockedObjects.create).not.toHaveBeenCalled();
  });

  it('400, если name длиннее 200 символов', async () => {
    const res = await request(buildApp())
      .post(`/projects/${PROJECT_ID}/objects`)
      .send({ name: 'x'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('name');
  });

  it('400, если use_ai_pricing не boolean', async () => {
    const res = await request(buildApp())
      .post(`/projects/${PROJECT_ID}/objects`)
      .send({ name: 'Объект', use_ai_pricing: 'да' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('use_ai_pricing');
  });

  it('опциональные поля можно не передавать (обратная совместимость)', async () => {
    mockedObjects.create.mockResolvedValue(dbObject());

    const res = await request(buildApp())
      .post(`/projects/${PROJECT_ID}/objects`)
      .send({ name: 'Объект' });

    expect(res.status).toBe(201);
    expect(mockedObjects.create).toHaveBeenCalledWith(PROJECT_ID, TEST_USER_ID, {
      name: 'Объект',
      city: null,
      address: null,
      use_ai_pricing: false,
    });
  });
});

describe('POST /api/projects/:projectId/objects — лимит 10 объектов (решение №10)', () => {
  it('403 OBJECT_LIMIT_REACHED при исчерпании лимита', async () => {
    mockedObjects.isLimitReached.mockResolvedValue(true);

    const res = await request(buildApp())
      .post(`/projects/${PROJECT_ID}/objects`)
      .send({ name: 'Объект 11' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('OBJECT_LIMIT_REACHED');
    expect(res.body.limit).toBe(10);
    expect(mockedObjects.create).not.toHaveBeenCalled();
  });
});

describe('PUT /api/objects/:id — Zod-валидация (решение №9)', () => {
  it('обновляет объект при валидном теле (200)', async () => {
    mockedObjects.findByIdAndUserId.mockResolvedValue(dbObject());
    mockedObjects.update.mockResolvedValue({ ...dbObject(), name: 'Новое имя' });

    const res = await request(buildApp())
      .put(`/objects/${OBJECT_ID}`)
      .send({ name: 'Новое имя', city: 'СПб', sort_order: 2 });

    expect(res.status).toBe(200);
    expect(mockedObjects.update).toHaveBeenCalledWith(
      OBJECT_ID,
      expect.objectContaining({ name: 'Новое имя', city: 'СПб', sort_order: 2 }),
    );
  });

  it('400 с телом ошибки, если name — пустая строка', async () => {
    mockedObjects.findByIdAndUserId.mockResolvedValue(dbObject());

    const res = await request(buildApp()).put(`/objects/${OBJECT_ID}`).send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.errors[0].field).toBe('name');
  });

  it('400, если sort_order не целое число', async () => {
    mockedObjects.findByIdAndUserId.mockResolvedValue(dbObject());

    const res = await request(buildApp())
      .put(`/objects/${OBJECT_ID}`)
      .send({ sort_order: 'first' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('sort_order');
  });
});
