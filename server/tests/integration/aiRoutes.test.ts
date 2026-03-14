/**
 * Integration tests for AI Routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import aiRouter from '../../src/routes/ai.js';

// Мокаем middleware
vi.mock('../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'test-user-id', email: 'test@test.com' };
    next();
  },
}));

vi.mock('../../src/middleware/rateLimiter.js', () => ({
  aiRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  },
}));

// Мокаем AI сервисы
vi.mock('../../src/services/ai/index.js', () => ({
  getAvailableAIProvider: vi.fn(() => null),
  isAIAvailable: vi.fn(() => false),
  generatePromptHash: vi.fn((type, params) => `hash-${type}-${JSON.stringify(params)}`),
  findCachedResponse: vi.fn(() => Promise.resolve(null)),
  saveCachedResponse: vi.fn(() => Promise.resolve('test-cache-id')),
  getUserAIHistory: vi.fn(() => Promise.resolve([])),
  getAIUsageStats: vi.fn(() =>
    Promise.resolve({
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {},
      byType: {},
    })
  ),
  shouldUseCache: vi.fn(() => true),
  getCacheTTL: vi.fn(() => 24 * 60 * 60 * 1000),
}));

// Создаём тестовое приложение
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
  return app;
};

describe('AI Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('GET /api/ai/status', () => {
    it('should return AI status', async () => {
      const response = await request(app).get('/api/ai/status');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('available');
      expect(response.body.data).toHaveProperty('provider');
    });
  });

  describe('GET /api/ai/history', () => {
    it('should return user AI history', async () => {
      const response = await request(app).get('/api/ai/history');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should accept limit and offset parameters', async () => {
      const response = await request(app)
        .get('/api/ai/history')
        .query({ limit: 10, offset: 5 });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/ai/stats', () => {
    it('should return usage statistics', async () => {
      const response = await request(app).get('/api/ai/stats');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('totalRequests');
      expect(response.body.data).toHaveProperty('totalTokens');
      expect(response.body.data).toHaveProperty('totalCost');
      expect(response.body.data).toHaveProperty('byProvider');
      expect(response.body.data).toHaveProperty('byType');
    });

    it('should accept period parameter', async () => {
      const response = await request(app)
        .get('/api/ai/stats')
        .query({ period: 7 });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/ai/estimate', () => {
    it('should return error when description is missing', async () => {
      const response = await request(app)
        .post('/api/ai/estimate')
        .send({ city: 'Москва' });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Description is required');
    });

    it('should return error when city is missing', async () => {
      const response = await request(app)
        .post('/api/ai/estimate')
        .send({ description: 'Ремонт ванной' });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('City is required');
    });

    it('should return mock data when AI is not available', async () => {
      const response = await request(app)
        .post('/api/ai/estimate')
        .send({
          description: 'Ремонт ванной комнаты',
          city: 'Москва',
          projectType: 'standard',
          area: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('description');
      expect(response.body.data).toHaveProperty('city');
      expect(response.body.data).toHaveProperty('estimatedCost');
      expect(response.body.meta.fallback).toBe(true);
      expect(response.body.meta.provider).toBe('mock');
    });
  });

  describe('POST /api/ai/suggest-materials', () => {
    it('should return error when workName is missing', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-materials')
        .send({ city: 'Москва', area: 50 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Work name is required');
    });

    it('should return error when city is missing', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-materials')
        .send({ workName: 'Покраска стен' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('City is required');
    });

    it('should return mock data when AI is not available', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-materials')
        .send({
          workName: 'Покраска стен',
          area: 50,
          city: 'Москва',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('workName');
      expect(response.body.data).toHaveProperty('materials');
      expect(response.body.data).toHaveProperty('tools');
      expect(response.body.meta.fallback).toBe(true);
    });
  });

  describe('POST /api/ai/generate-template', () => {
    it('should return error when roomType is missing', async () => {
      const response = await request(app)
        .post('/api/ai/generate-template')
        .send({ city: 'Москва', area: 20 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Room type is required');
    });

    it('should return error when city is missing', async () => {
      const response = await request(app)
        .post('/api/ai/generate-template')
        .send({ roomType: 'bathroom' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('City is required');
    });

    it('should return mock data for bathroom', async () => {
      const response = await request(app)
        .post('/api/ai/generate-template')
        .send({
          roomType: 'bathroom',
          area: 8,
          city: 'Москва',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.roomType).toBe('bathroom');
      expect(response.body.data).toHaveProperty('works');
      expect(Array.isArray(response.body.data.works)).toBe(true);
      expect(response.body.meta.fallback).toBe(true);
    });

    it('should return mock data for bedroom', async () => {
      const response = await request(app)
        .post('/api/ai/generate-template')
        .send({
          roomType: 'bedroom',
          area: 20,
          city: 'Москва',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.roomType).toBe('bedroom');
    });

    it('should return mock data for unknown room types', async () => {
      const response = await request(app)
        .post('/api/ai/generate-template')
        .send({
          roomType: 'unknown-room',
          area: 15,
          city: 'Москва',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('works');
    });
  });
});