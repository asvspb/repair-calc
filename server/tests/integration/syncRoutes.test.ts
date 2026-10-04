/**
 * Integration tests for SYNC-V2 routes (спека SPEC-SYNC-V2 §3, §5(в)).
 *
 * Матрица конфликтов: сервер новее / клиент новее / ничья (tie-break §3.2);
 * инкрементальный pull `?since=` не возвращает неизменённые проекты; без `since` —
 * полный pull как сегодня (обратная совместимость со старым клиентом).
 * Репозитории замоканы; ходим через настоящий роутер (server/src/routes/sync.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const TEST_USER_ID = 'user-1';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';

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

vi.mock('../../src/db/repositories/project.repo.js', () => ({
  ProjectRepository: {
    findByIdAndUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findAllByUserIdWithObjects: vi.fn(),
  },
}));

vi.mock('../../src/db/repositories/object.repo.js', () => ({
  ObjectRepository: {
    findByIdAndUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../src/db/repositories/room.repo.js', () => ({
  RoomRepository: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

import syncRouter from '../../src/routes/sync.js';
import { ProjectRepository } from '../../src/db/repositories/project.repo.js';
import { ObjectRepository } from '../../src/db/repositories/object.repo.js';
import { RoomRepository } from '../../src/db/repositories/room.repo.js';

const mockedProjects = ProjectRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockedObjects = ObjectRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockedRooms = RoomRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sync', syncRouter);
  return app;
}

function makeChange(entity: string, entityId: string, clientUpdatedAt?: string) {
  return {
    id: entityId,
    entity,
    entityId,
    timestamp: Date.now(),
    operation: 'update',
    data: { name: 'client', clientUpdatedAt },
  };
}

const serverProjectRow = {
  id: PROJECT_ID,
  user_id: TEST_USER_ID,
  name: 'server',
  city: null,
  use_ai_pricing: false,
  version: 3,
  updated_at: new Date('2026-01-02T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/sync/push — LWW (§3.1, §3.2)', () => {
  it('сервер новее (clientUpdatedAt < updated_at) → конфликт с serverUpdatedAt/serverEntity', async () => {
    mockedProjects.findByIdAndUserId.mockResolvedValue(serverProjectRow);
    mockedProjects.update.mockResolvedValue(serverProjectRow);

    const res = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('project', PROJECT_ID, '2026-01-01T00:00:00Z')] });

    expect(res.status).toBe(200);
    expect(res.body.data.synced).toHaveLength(0);
    expect(res.body.data.conflicts).toHaveLength(1);
    expect(res.body.data.conflicts[0].serverUpdatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(res.body.data.conflicts[0].serverEntity.id).toBe(PROJECT_ID);
    expect(mockedProjects.update).not.toHaveBeenCalled();
  });

  it('клиент новее (clientUpdatedAt > updated_at) → synced, обновление выполнено', async () => {
    mockedProjects.findByIdAndUserId.mockResolvedValue(serverProjectRow);

    const res = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('project', PROJECT_ID, '2026-01-03T00:00:00Z')] });

    expect(res.status).toBe(200);
    expect(res.body.data.synced).toEqual([PROJECT_ID]);
    expect(res.body.data.conflicts).toHaveLength(0);
    expect(mockedProjects.update).toHaveBeenCalledWith(PROJECT_ID, { name: 'client' });
  });

  it('ничья по updatedAt (tie-break §3.2): равные id → серверная сторона (конфликт)', async () => {
    mockedProjects.findByIdAndUserId.mockResolvedValue(serverProjectRow);

    const res = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('project', PROJECT_ID, '2026-01-02T00:00:00Z')] });

    expect(res.body.data.synced).toHaveLength(0);
    expect(res.body.data.conflicts).toHaveLength(1);
  });

  it('лучшая по id сторона (§3.2): больший id побеждает', async () => {
    // id entityId лексикографически больше id серверной строки → клиентская побеждает
    const biggerId = '99999999-9999-4999-8999-999999999999';
    const row = { ...serverProjectRow, id: '11111111-1111-4111-8111-111111111111' };
    mockedProjects.findByIdAndUserId.mockResolvedValue(row);

    const res = await request(buildApp())
      .post('/api/sync/push')
      .send({
        changes: [{ ...makeChange('project', biggerId, '2026-01-02T00:00:00Z'), id: biggerId }],
      });

    // entityId != существующего id → findByIdAndUserId(biggerId) вернёт null в реальности,
    // но здесь замокан всегда возвращает row — сравниваем tie-break: biggerId > row.id → client
    expect(res.body.data.synced).toEqual([biggerId]);
  });

  it('комната: сервер новее → конфликт; клиент новее → synced', async () => {
    const serverRoom = {
      id: ROOM_ID,
      object_id: OBJECT_ID,
      name: 'server',
      version: 2,
      updated_at: new Date('2026-01-02T00:00:00Z'),
    };
    mockedRooms.findById.mockResolvedValue(serverRoom);
    mockedObjects.findByIdAndUserId.mockResolvedValue({ id: OBJECT_ID });

    const older = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('room', ROOM_ID, '2026-01-01T00:00:00Z')] });
    expect(older.body.data.conflicts).toHaveLength(1);
    expect(older.body.data.conflicts[0].serverUpdatedAt).toBe('2026-01-02T00:00:00.000Z');

    mockedRooms.update.mockResolvedValue(serverRoom);
    const newer = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('room', ROOM_ID, '2026-01-03T00:00:00Z')] });
    expect(newer.body.data.synced).toEqual([ROOM_ID]);
  });

  it('entity object: серверная строка новее → конфликт; клиент новее → обновление', async () => {
    const serverObject = {
      id: OBJECT_ID,
      project_id: PROJECT_ID,
      name: 'server',
      version: 1,
      updated_at: new Date('2026-01-02T00:00:00Z'),
    };
    mockedObjects.findByIdAndUserId.mockResolvedValue(serverObject);

    const older = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('object', OBJECT_ID, '2026-01-01T00:00:00Z')] });
    expect(older.body.data.conflicts).toHaveLength(1);

    mockedObjects.update.mockResolvedValue(serverObject);
    const newer = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('object', OBJECT_ID, '2026-01-03T00:00:00Z')] });
    expect(newer.body.data.synced).toEqual([OBJECT_ID]);
    expect(mockedObjects.update).toHaveBeenCalledWith(OBJECT_ID, { name: 'client' });
  });

  it('entity object: не найден → upsert-создание через ObjectRepository.create', async () => {
    mockedObjects.findByIdAndUserId.mockResolvedValue(null);
    mockedProjects.findByIdAndUserId.mockResolvedValue(serverProjectRow);
    mockedObjects.create.mockResolvedValue({ id: OBJECT_ID });

    const res = await request(buildApp())
      .post('/api/sync/push')
      .send({
        changes: [
          {
            ...makeChange('object', OBJECT_ID, '2026-01-03T00:00:00Z'),
            data: {
              name: 'client',
              project_id: PROJECT_ID,
              clientUpdatedAt: '2026-01-03T00:00:00Z',
            },
          },
        ],
      });

    expect(res.body.data.synced).toEqual([OBJECT_ID]);
    expect(mockedObjects.create).toHaveBeenCalledWith(
      PROJECT_ID,
      TEST_USER_ID,
      expect.objectContaining({ name: 'client' }),
    );
  });

  it('проект: не найден → upsert-создание (local-* ID, §3.4)', async () => {
    mockedProjects.findByIdAndUserId.mockResolvedValue(null);
    mockedProjects.create.mockResolvedValue({ ...serverProjectRow, id: PROJECT_ID });

    const res = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('project', PROJECT_ID, '2026-01-03T00:00:00Z')] });

    expect(res.body.data.synced).toEqual([PROJECT_ID]);
    expect(mockedProjects.create).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ name: 'client' }),
    );
  });

  it('нет clientUpdatedAt → конфликт не выставляется (приемлемо, old-client safe)', async () => {
    mockedProjects.findByIdAndUserId.mockResolvedValue(serverProjectRow);

    const res = await request(buildApp())
      .post('/api/sync/push')
      .send({ changes: [makeChange('project', PROJECT_ID)] });

    expect(res.body.data.synced).toEqual([PROJECT_ID]);
  });
});

describe('GET /api/sync/pull — инкрементальный `?since=` (§4)', () => {
  const oldRoom = {
    id: ROOM_ID,
    object_id: OBJECT_ID,
    name: 'old',
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
  const oldObject = {
    id: OBJECT_ID,
    project_id: PROJECT_ID,
    name: 'old',
    updated_at: new Date('2026-01-01T00:00:00Z'),
    rooms: [oldRoom],
  };
  const oldProject = {
    id: PROJECT_ID,
    name: 'old',
    updated_at: new Date('2026-01-01T00:00:00Z'),
    objects: [oldObject],
  };

  it('без since — полный pull как сегодня (обратная совместимость)', async () => {
    mockedProjects.findAllByUserIdWithObjects.mockResolvedValue([oldProject]);

    const res = await request(buildApp()).get('/api/sync/pull');

    expect(res.status).toBe(200);
    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.projects[0].objects).toHaveLength(1);
  });

  it('с since — неизменённый проект не возвращается', async () => {
    mockedProjects.findAllByUserIdWithObjects.mockResolvedValue([oldProject]);

    const res = await request(buildApp()).get('/api/sync/pull?since=2026-01-02T00:00:00Z');

    expect(res.status).toBe(200);
    expect(res.body.data.projects).toHaveLength(0);
  });

  it('с since — изменилась только комната: проект и объект возвращаются, комната одна', async () => {
    const changedRoom = {
      ...oldRoom,
      name: 'changed',
      updated_at: new Date('2026-01-03T00:00:00Z'),
    };
    mockedProjects.findAllByUserIdWithObjects.mockResolvedValue([
      { ...oldProject, objects: [{ ...oldObject, rooms: [changedRoom] }] },
    ]);

    const res = await request(buildApp()).get('/api/sync/pull?since=2026-01-02T00:00:00Z');

    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.projects[0].objects).toHaveLength(1);
    expect(res.body.data.projects[0].objects[0].rooms).toHaveLength(1);
    expect(res.body.data.projects[0].objects[0].rooms[0].name).toBe('changed');
  });

  it('с since — изменился только проект: возвращается без объектов', async () => {
    const changedProject = {
      ...oldProject,
      name: 'changed',
      updated_at: new Date('2026-01-03T00:00:00Z'),
    };
    mockedProjects.findAllByUserIdWithObjects.mockResolvedValue([changedProject]);

    const res = await request(buildApp()).get('/api/sync/pull?since=2026-01-02T00:00:00Z');

    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.projects[0].objects).toHaveLength(0);
  });

  it('некорректный since → полный pull', async () => {
    mockedProjects.findAllByUserIdWithObjects.mockResolvedValue([oldProject]);

    const res = await request(buildApp()).get('/api/sync/pull?since=not-a-date');

    expect(res.body.data.projects).toHaveLength(1);
  });
});
