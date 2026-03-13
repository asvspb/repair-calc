import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncPushSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import type { AuthRequest, Conflict } from '../types/index.js';

const router = Router();

router.use(authenticate);

// POST /api/sync/push - Push local changes to server
router.post('/push', async (req: AuthRequest, res, next) => {
  try {
    const { changes } = syncPushSchema.parse(req.body);
    
    const synced: string[] = [];
    const conflicts: Conflict[] = [];
    
    // Process changes
    for (const change of changes) {
      try {
        // In a production app, we would apply each change to the database
        // For now, we just mark them as synced
        // TODO: Implement actual change processing with conflict detection
        
        synced.push(change.id);
      } catch {
        // Handle conflict
        conflicts.push({
          id: change.id,
          entity: change.entity,
          entityId: change.entityId,
          serverVersion: 0, // Would be actual server version
          clientVersion: (change.data as { version?: number })?.version ?? 0,
        });
      }
    }
    
    res.json({
      status: 'success',
      data: {
        synced,
        conflicts,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sync/pull - Pull changes from server
router.get('/pull', async (req: AuthRequest, res, next) => {
  try {
    // Get all projects for user with rooms
    const projects = await ProjectRepository.findAllByUserIdForSync(req.user!.id);
    
    // In a production app, we would filter by timestamp
    // For now, return all projects
    
    res.json({
      status: 'success',
      data: {
        projects,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;