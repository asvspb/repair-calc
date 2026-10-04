import { transaction } from '../pool.js';
import type { Project, Room, ProjectWithObjects } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from '../pool.js';
import { winstonLogger } from '../../middleware/logger.js';
import { ProjectUpdateRoomsRepository } from './projectUpdateRooms.repo.js';

/**
 * Обновление проекта с массивом объектов (и вложенных комнат) в одной транзакции
 * (P3-SPLIT): вынесено из ProjectRepository (project.repo.ts), доступно через него
 * по цепочке наследования.
 */
export class ProjectUpdateObjectsRepository extends ProjectUpdateRoomsRepository {
  private static isServerUuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Update project with multiple objects in a transaction
   */
  static async updateWithObjects(
    projectId: string,
    userId: string,
    projectData: Partial<Project>,
    objectsData: any[],
  ): Promise<ProjectWithObjects> {
    return transaction(async conn => {
      // Verify ownership
      const existingRows = await conn.query<(Project & RowDataPacket)[]>(
        'SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [projectId, userId],
      );

      if (!existingRows[0]) {
        throw new Error('Project not found');
      }

      // Update project
      const fields: string[] = [];
      const values: (string | number | boolean | Date | null)[] = [];

      if (projectData.name !== undefined) {
        fields.push('name = ?');
        values.push(projectData.name);
      }
      if (projectData.city !== undefined) {
        fields.push('city = ?');
        values.push(projectData.city);
      }
      if (projectData.use_ai_pricing !== undefined) {
        fields.push('use_ai_pricing = ?');
        values.push(projectData.use_ai_pricing);
      }
      if (projectData.last_ai_price_update !== undefined) {
        fields.push('last_ai_price_update = ?');
        values.push(projectData.last_ai_price_update);
      }

      if (fields.length > 0) {
        values.push(projectId);
        await conn.execute(
          `UPDATE projects SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          values,
        );
      }

      // Get existing objects
      const existingObjectsResult = await conn.query<(any & RowDataPacket)[]>(
        'SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL',
        [projectId],
      );
      const existingObjects = existingObjectsResult[0] || [];

      // Build a map of existing objects by ID
      const existingObjectsMap = new Map<string, any>();
      for (const obj of existingObjects) {
        existingObjectsMap.set(obj.id, obj);
      }

      // Track which server UUIDs are being used (for keeping track of what to delete)
      const usedServerObjectIds = new Set<string>();

      // Update or create each object
      for (const objData of objectsData) {
        let objectId: string;
        const inputId = objData.id;

        // Determine if this is a valid server UUID that exists
        const isServerId = inputId && this.isServerUuid(inputId);
        const existingObject = isServerId ? existingObjectsMap.get(inputId) : null;

        if (existingObject) {
          // Update existing object
          objectId = inputId;
          usedServerObjectIds.add(objectId);

          const objFields: string[] = [];
          const objValues: (string | number | null)[] = [];

          if (objData.name !== undefined) {
            objFields.push('name = ?');
            objValues.push(objData.name);
          }
          if (objData.city !== undefined) {
            objFields.push('city = ?');
            objValues.push(objData.city);
          }

          if (objFields.length > 0) {
            objValues.push(objectId, projectId);
            await conn.execute(
              `UPDATE objects SET ${objFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?`,
              objValues,
            );
          }
        } else {
          // Create new object with a new server UUID
          // This handles both: no ID provided, or local ID (like "local-obj-...")
          objectId = uuidv4();
          winstonLogger.info('Создание нового объекта', {
            name: objData.name || '',
            localId: inputId || null,
            serverId: objectId,
          });
          await conn.execute(
            `INSERT INTO objects (id, project_id, user_id, name, city, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              objectId,
              projectId,
              userId,
              objData.name || '',
              objData.city || null,
              objData.sort_order || 0,
            ],
          );
        }

        // Get existing rooms for this object
        const existingRoomsResult = await conn.query<(Room & RowDataPacket)[]>(
          'SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL',
          [objectId],
        );
        const existingRooms = existingRoomsResult[0] || [];
        const existingRoomsMap = new Map<string, Room>();
        for (const room of existingRooms) {
          existingRoomsMap.set(room.id, room);
        }

        // Track which server room UUIDs are being used
        const usedServerRoomIds = new Set<string>();

        // Update or create each room
        if (objData.rooms && objData.rooms.length > 0) {
          for (const room of objData.rooms) {
            const inputRoomId = room.id;
            const isServerRoomId = inputRoomId && this.isServerUuid(inputRoomId);
            const existingRoom = isServerRoomId ? existingRoomsMap.get(inputRoomId) : null;

            let roomId: string;

            if (existingRoom) {
              // Update existing room
              roomId = inputRoomId;
              usedServerRoomIds.add(roomId);

              const roomFields: string[] = [];
              const roomValues: (string | number | null)[] = [];

              if (room.name !== undefined) {
                roomFields.push('name = ?');
                roomValues.push(room.name);
              }
              if (room.geometry_mode !== undefined) {
                roomFields.push('geometry_mode = ?');
                roomValues.push(room.geometry_mode);
              }
              if (room.length !== undefined) {
                roomFields.push('length = ?');
                roomValues.push(room.length);
              }
              if (room.width !== undefined) {
                roomFields.push('width = ?');
                roomValues.push(room.width);
              }
              if (room.height !== undefined) {
                roomFields.push('height = ?');
                roomValues.push(room.height);
              }
              if (room.segments !== undefined) {
                roomFields.push('segments = ?');
                roomValues.push(room.segments ? JSON.stringify(room.segments) : null);
              }
              if (room.obstacles !== undefined) {
                roomFields.push('obstacles = ?');
                roomValues.push(room.obstacles ? JSON.stringify(room.obstacles) : null);
              }
              if (room.wall_sections !== undefined) {
                roomFields.push('wall_sections = ?');
                roomValues.push(room.wall_sections ? JSON.stringify(room.wall_sections) : null);
              }
              if (room.sub_sections !== undefined) {
                roomFields.push('sub_sections = ?');
                roomValues.push(room.sub_sections ? JSON.stringify(room.sub_sections) : null);
              }
              if (room.windows !== undefined) {
                roomFields.push('windows = ?');
                roomValues.push(room.windows ? JSON.stringify(room.windows) : null);
              }
              if (room.doors !== undefined) {
                roomFields.push('doors = ?');
                roomValues.push(room.doors ? JSON.stringify(room.doors) : null);
              }
              if (room.works !== undefined) {
                roomFields.push('works = ?');
                roomValues.push(room.works ? JSON.stringify(room.works) : null);
              }
              if (room.sort_order !== undefined) {
                roomFields.push('sort_order = ?');
                roomValues.push(room.sort_order);
              }

              if (roomFields.length > 0) {
                roomValues.push(roomId, objectId);
                await conn.execute(
                  `UPDATE rooms SET ${roomFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND object_id = ?`,
                  roomValues,
                );
              }
            } else {
              // Create new room with a new server UUID
              // This handles both: no ID provided, or local ID (like "local-room-...")
              roomId = uuidv4();
              winstonLogger.info('Создание новой комнаты', {
                name: room.name || 'Комната',
                localId: inputRoomId || null,
                serverId: roomId,
              });
              await conn.execute(
                `INSERT INTO rooms (id, object_id, project_id, name, geometry_mode, length, width, height, segments, obstacles, wall_sections, sub_sections, windows, doors, works, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  roomId,
                  objectId,
                  projectId,
                  room.name || 'Комната',
                  room.geometry_mode || 'simple',
                  room.length ?? 0,
                  room.width ?? 0,
                  room.height ?? 0,
                  JSON.stringify(room.segments ?? []),
                  JSON.stringify(room.obstacles ?? []),
                  JSON.stringify(room.wall_sections ?? []),
                  JSON.stringify(room.sub_sections ?? []),
                  JSON.stringify(room.windows ?? []),
                  JSON.stringify(room.doors ?? []),
                  JSON.stringify(room.works ?? []),
                  room.sort_order ?? 0,
                ],
              );
            }
          }
        }

        // Soft delete rooms that are no longer in the request (only for server UUIDs that exist)
        const existingRoomIds = Array.from(existingRoomsMap.keys());
        const roomIdsToDelete = existingRoomIds.filter(id => !usedServerRoomIds.has(id));

        if (roomIdsToDelete.length > 0) {
          const placeholders = roomIdsToDelete.map(() => '?').join(',');
          await conn.execute(
            `UPDATE rooms SET deleted_at = CURRENT_TIMESTAMP WHERE object_id = ? AND id IN (${placeholders}) AND deleted_at IS NULL`,
            [objectId, ...roomIdsToDelete],
          );
          winstonLogger.info('Удалено комнат', { count: roomIdsToDelete.length });
        }
      }

      // Return updated project with objects
      const updated = await this.findById(projectId);
      if (!updated) throw new Error('Project not found after update');

      const objectsResult = await conn.query<(any & RowDataPacket)[]>(
        'SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order',
        [projectId],
      );

      const objects = objectsResult[0] || [];
      const objectsWithRooms = await Promise.all(
        objects.map(async (obj: any) => {
          const roomsResult = await conn.query<(Room & RowDataPacket)[]>(
            'SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order',
            [obj.id],
          );
          return { ...obj, rooms: roomsResult[0] || [] };
        }),
      );

      return { ...updated, objects: objectsWithRooms };
    });
  }
}
