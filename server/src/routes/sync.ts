import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncPushSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { RoomRepository } from '../db/repositories/room.repo.js';
import { transaction } from '../db/pool.js';
import type { AuthRequest, Conflict, ChangeLogEntry, Room } from '../types/index.js';
import type { RowDataPacket } from 'mysql2/promise';

const router = Router();

router.use(authenticate);

/**
 * POST /api/sync/push - Push local changes to server
 * Implements last-write-wins conflict resolution with version checking
 */
router.post('/push', async (req: AuthRequest, res, next) => {
  try {
    const { changes } = syncPushSchema.parse(req.body);
    const userId = req.user!.id;

    const synced: string[] = [];
    const conflicts: Conflict[] = [];

    // Process each change
    for (const change of changes) {
      try {
        const changeData = change as ChangeLogEntry & { id: string };
        const { id, entity, entityId, data, timestamp } = changeData;
        const clientVersion = (data as { version?: number })?.version ?? 0;
        const roomData = data as Partial<Room>;
        const projectData = data as { name?: string; city?: string; use_ai_pricing?: boolean };

        if (entity === 'project') {
          // Check if project exists and get server version
          const serverProject = await ProjectRepository.findByIdAndUserId(entityId, userId);
          
          if (!serverProject) {
            // Project doesn't exist - skip or create
            conflicts.push({
              id,
              entity: 'project',
              entityId,
              serverVersion: 0,
              clientVersion,
            });
            continue;
          }

          // Check for conflict using last-write-wins with version
          const serverVersion = serverProject.version;
          const serverUpdatedAt = new Date(serverProject.updated_at).getTime();
          
          // If client version is older or same timestamp, it's a conflict
          if (clientVersion && clientVersion < serverVersion) {
            conflicts.push({
              id,
              entity: 'project',
              entityId,
              serverVersion,
              clientVersion,
            });
            continue;
          }

          // Apply update (last-write-wins if timestamp is newer)
          const updateData: Partial<typeof serverProject> = {};
          if (projectData.name !== undefined) updateData.name = projectData.name;
          if (projectData.city !== undefined) updateData.city = projectData.city;
          if (projectData.use_ai_pricing !== undefined) updateData.use_ai_pricing = projectData.use_ai_pricing;

          await ProjectRepository.update(entityId, updateData);
          synced.push(id);
        } else if (entity === 'room') {
          // Check if room exists
          const serverRoom = await RoomRepository.findById(entityId);
          
          if (!serverRoom) {
            // Room doesn't exist - create it (only if project_id is present)
            if (!roomData.project_id) {
              throw new Error('project_id is required for room creation');
            }
            const roomId = await RoomRepository.create(roomData.project_id, roomData);
            synced.push(roomId.id);
            continue;
          }

          // Check ownership
          const project = await ProjectRepository.findByIdAndUserId(serverRoom.project_id, userId);
          if (!project) {
            conflicts.push({
              id,
              entity: 'room',
              entityId,
              serverVersion: 0,
              clientVersion,
            });
            continue;
          }

          // Check for conflict
          const serverVersion = serverRoom.version ?? 0;
          if (clientVersion && clientVersion < serverVersion) {
            conflicts.push({
              id,
              entity: 'room',
              entityId,
              serverVersion,
              clientVersion,
            });
            continue;
          }

          // Apply update
          const updateData: Partial<typeof serverRoom> = {};
          if (roomData.name !== undefined) updateData.name = roomData.name;
          if (roomData.geometry_mode !== undefined) updateData.geometry_mode = roomData.geometry_mode;
          if (roomData.length !== undefined) updateData.length = roomData.length;
          if (roomData.width !== undefined) updateData.width = roomData.width;
          if (roomData.height !== undefined) updateData.height = roomData.height;
          if (roomData.segments !== undefined) updateData.segments = roomData.segments;
          if (roomData.obstacles !== undefined) updateData.obstacles = roomData.obstacles;
          if (roomData.wall_sections !== undefined) updateData.wall_sections = roomData.wall_sections;
          if (roomData.sub_sections !== undefined) updateData.sub_sections = roomData.sub_sections;
          if (roomData.windows !== undefined) updateData.windows = roomData.windows;
          if (roomData.doors !== undefined) updateData.doors = roomData.doors;
          if (roomData.works !== undefined) updateData.works = roomData.works;

          await RoomRepository.update(entityId, updateData);
          synced.push(id);
        }
      } catch (error) {
        // Log error but continue with other changes
        console.error('Error processing sync change:', error);
        conflicts.push({
          id: change.id,
          entity: change.entity,
          entityId: change.entityId,
          serverVersion: 0,
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