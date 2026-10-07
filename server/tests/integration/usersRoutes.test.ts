/**
 * Integration tests for /api/users/me (трассировка ТЗ v1.1, пункт 6.1 / решение №4):
 * is_premium/premium_expires_at читаются честно из user-записи БД, не хардкодом.
 * Репозиторий замокан; ходим через настоящий роутер + errorHandler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const TEST_USER_ID = 'user-1';

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

vi.mock('../../src/db/repositories/user.repo.js', () => ({
  UserRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

import usersRouter from '../../src/routes/users.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { UserRepository } from '../../src/db/repositories/user.repo.js';

const mockedUsers = UserRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', usersRouter);
  app.use(errorHandler);
  return app;
}

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_USER_ID,
    email: 'test@test.com',
    name: 'Test',
    is_premium: false,
    premium_expires_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/users/me — is_premium из БД (решение №4 трассировки)', () => {
  it('отдаёт is_premium=false, когда в записи БД false/нет колонки', async () => {
    mockedUsers.findById.mockResolvedValue(dbUser({ is_premium: false }));

    const res = await request(buildApp()).get('/api/users/me');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_premium).toBe(false);
    expect(res.body.data.premium_expires_at).toBeNull();
  });

  it('отдаёт is_premium=true и premium_expires_at из записи БД, когда премиум проставлен', async () => {
    const expires = new Date('2027-01-01T00:00:00.000Z');
    mockedUsers.findById.mockResolvedValue(
      dbUser({ is_premium: true, premium_expires_at: expires }),
    );

    const res = await request(buildApp()).get('/api/users/me');

    expect(res.status).toBe(200);
    expect(res.body.data.is_premium).toBe(true);
    expect(res.body.data.premium_expires_at).toBe(expires.toISOString());
  });

  it('трактует отсутствующее поле (undefined) как is_premium=false', async () => {
    mockedUsers.findById.mockResolvedValue(dbUser({ is_premium: undefined }));

    const res = await request(buildApp()).get('/api/users/me');

    expect(res.status).toBe(200);
    expect(res.body.data.is_premium).toBe(false);
  });

  it('404, если пользователь не найден', async () => {
    mockedUsers.findById.mockResolvedValue(null);

    const res = await request(buildApp()).get('/api/users/me');

    expect(res.status).toBe(404);
  });
});
