import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { CalculatedTotalsRepository } from '../db/repositories/calculatedTotals.repo.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { notFound } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

interface SaveTotalsRequest {
  total_area: number;
  total_works: number;
  total_materials: number;
  total_tools: number;
  grand_total: number;
}

// POST /api/totals/:projectId - Save calculated totals for a project
router.post('/:projectId', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({
        status: 'error',
        message: 'Project ID is required',
      });
    }
    
    const totals: SaveTotalsRequest = req.body;

    // Validate required fields
    if (
      totals.total_area === undefined ||
      totals.total_works === undefined ||
      totals.total_materials === undefined ||
      totals.total_tools === undefined ||
      totals.grand_total === undefined
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
      });
    }

    // Check project ownership
    const project = await ProjectRepository.findByIdAndUserId(projectId, req.user!.id);
    if (!project) {
      throw notFound('Project not found');
    }

    // Save totals
    const saved = await CalculatedTotalsRepository.upsert(projectId, {
      total_area: totals.total_area,
      total_works: totals.total_works,
      total_materials: totals.total_materials,
      total_tools: totals.total_tools,
      grand_total: totals.grand_total,
    });

    res.json({
      status: 'success',
      data: saved,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/totals/:projectId - Get calculated totals for a project
router.get('/:projectId', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({
        status: 'error',
        message: 'Project ID is required',
      });
    }

    // Check project ownership
    const project = await ProjectRepository.findByIdAndUserId(projectId, req.user!.id);
    if (!project) {
      throw notFound('Project not found');
    }

    const totals = await CalculatedTotalsRepository.findByProjectId(projectId);

    res.json({
      status: 'success',
      data: totals,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
