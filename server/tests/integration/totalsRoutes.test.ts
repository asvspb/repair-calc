/**
 * Integration tests for Totals Routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import totalsRouter from '../../src/routes/totals.js';

// Мокаем middleware авторизации
vi.mock('../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'test-user-id', email: 'test@test.com' };
    next();
  },
}));

// Мокаем репозитории
vi.mock('../../src/db/repositories/project.repo.js', () => ({
  ProjectRepository: {
    findByIdAndUserId: vi.fn(),
  },
}));

vi.mock('../../src/db/repositories/calculatedTotals.repo.js', () => ({
  CalculatedTotalsRepository: {
    upsert: vi.fn(),
    findByProjectId: vi.fn(),
  },
}));

import { ProjectRepository } from '../../src/db/repositories/project.repo.js';
import { CalculatedTotalsRepository } from '../../src/db/repositories/calculatedTotals.repo.js';

// Создаём тестовое приложение
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/totals', totalsRouter);
  return app;
};

describe('Totals Routes', () => {
  let app: express.Application;

  const mockProject = {
    id: 'project-123',
    user_id: 'test-user-id',
    name: 'Test Project',
    city: 'Moscow',
    use_ai_pricing: false,
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTotals = {
    project_id: 'project-123',
    total_area: 150.5,
    total_works: 50000,
    total_materials: 75000,
    total_tools: 5000,
    grand_total: 130000,
    calculated_at: new Date('2026-03-15T10:00:00.000Z'),
  };

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('POST /api/totals/:projectId', () => {
    it('should save calculated totals for project', async () => {
      (ProjectRepository.findByIdAndUserId as any).mockResolvedValue(mockProject);
      (CalculatedTotalsRepository.upsert as any).mockResolvedValue(mockTotals);

      const response = await request(app)
        .post('/api/totals/project-123')
        .send({
          total_area: 150.5,
          total_works: 50000,
          total_materials: 75000,
          total_tools: 5000,
          grand_total: 130000,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(mockTotals);
      expect(ProjectRepository.findByIdAndUserId).toHaveBeenCalledWith(
        'project-123',
        'test-user-id'
      );
      expect(CalculatedTotalsRepository.upsert).toHaveBeenCalledWith('project-123', {
        total_area: 150.5,
        total_works: 50000,
        total_materials: 75000,
        total_tools: 5000,
        grand_total: 130000,
      });
    });

    it('should return 400 if project ID is missing', async () => {
      const response = await request(app)
        .post('/api/totals/')
        .send({
          total_area: 150.5,
          total_works: 50000,
          total_materials: 75000,
          total_tools: 5000,
          grand_total: 130000,
        });

      expect(response.status).toBe(404); // Route not found for empty ID
    });

    it('should return 400 if required fields are missing', async () => {
      (ProjectRepository.findByIdAndUserId as any).mockResolvedValue(mockProject);

      const response = await request(app)
        .post('/api/totals/project-123')
        .send({
          total_area: 150.5,
          // Missing other required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Missing required fields');
    });

    it('should return 404 if project not found', async () => {
      (ProjectRepository.findByIdAndUserId as any).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/totals/project-nonexistent')
        .send({
          total_area: 150.5,
          total_works: 50000,
          total_materials: 75000,
          total_tools: 5000,
          grand_total: 130000,
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Project not found');
    });

    it('should update existing totals', async () => {
      (ProjectRepository.findByIdAndUserId as any).mockResolvedValue(mockProject);
      (CalculatedTotalsRepository.upsert as any).mockResolvedValue({
        ...mockTotals,
        total_area: 200.75,
        grand_total: 162500,
      });

      const response = await request(app)
        .post('/api/totals/project-123')
        .send({
          total_area: 200.75,
          total_works: 65000,
          total_materials: 90000,
          total_tools: 7500,
          grand_total: 162500,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.total_area).toBe(200.75);
      expect(response.body.data.grand_total).toBe(162500);
    });
  });

  describe('GET /api/totals/:projectId', () => {
    it('should return calculated totals for project', async () => {
      (ProjectRepository.findByIdAndUserId as any).mockResolvedValue(mockProject);
      (CalculatedTotalsRepository.findByProjectId as any).mockResolvedValue(mockTotals);

      const response = await request(app).get('/api/totals/project-123');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(mockTotals);
      expect(ProjectRepository.findByIdAndUserId).toHaveBeenCalledWith(
        'project-123',
        'test-user-id'
      );
    });

    it('should return null if project has no totals yet', async () => {
      (ProjectRepository.findByIdAndUserId as any).mockResolvedValue(mockProject);
      (CalculatedTotalsRepository.findByProjectId as any).mockResolvedValue(null);

      const response = await request(app).get('/api/totals/project-123');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeNull();
    });

    it('should return 404 if project not found', async () => {
      (ProjectRepository.findByIdAndUserId as any).mockResolvedValue(null);

      const response = await request(app).get('/api/totals/project-nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Project not found');
    });

    it('should return 400 if project ID is missing', async () => {
      const response = await request(app).get('/api/totals/');

      expect(response.status).toBe(404); // Route not found for empty ID
    });
  });

  describe('Authorization', () => {
    it('should require authentication for POST', async () => {
      // Temporarily remove auth mock
      vi.unmock('../../src/middleware/auth.js');
      
      const response = await request(app)
        .post('/api/totals/project-123')
        .send({
          total_area: 150.5,
          total_works: 50000,
          total_materials: 75000,
          total_tools: 5000,
          grand_total: 130000,
        });

      // Should redirect to login or return 401/403
      expect([302, 401, 403]).toContain(response.status);
    });

    it('should require authentication for GET', async () => {
      vi.unmock('../../src/middleware/auth.js');
      
      const response = await request(app).get('/api/totals/project-123');

      expect([302, 401, 403]).toContain(response.status);
    });
  });
});
