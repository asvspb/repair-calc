import { query, execute, getConnection, transaction } from '../pool.js';
import type { Project, Room, ProjectWithRooms, Object, ObjectWithRooms, ProjectWithObjects } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';

export class ProjectRepository {
  static async create(userId: string, data: { name: string; city?: string; use_ai_pricing?: boolean }): Promise<ProjectWithObjects> {
    const id = uuidv4();
    const objectId = uuidv4();

    await transaction(async () => {
      // Создаём проект
      await execute(
        `INSERT INTO projects (id, user_id, name, city, use_ai_pricing) VALUES (?, ?, ?, ?, ?)`,
        [id, userId, data.name, data.city || null, data.use_ai_pricing || false]
      );

      // Создаём первый объект для проекта
      await execute(
        `INSERT INTO objects (id, project_id, user_id, name, city, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [objectId, id, userId, data.name, data.city || null, 0]
      );
    });

    const project = await this.findByIdWithObjects(id, userId);
    return project!;
  }

  static async findById(id: string): Promise<Project | null> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    return rows[0] || null;
  }

  static async findByIdWithObjects(id: string, userId: string): Promise<ProjectWithObjects | null> {
    const project = await this.findByIdAndUserId(id, userId);
    if (!project) return null;

    const objects = await query<(Object & RowDataPacket)[]>(
      `SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
      [id]
    );

    const objectsWithRooms = await Promise.all(
      objects.map(async (obj) => {
        const rooms = await query<(Room & RowDataPacket)[]>(
          `SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [obj.id]
        );
        return { ...obj, rooms };
      })
    );

    return { ...project, objects: objectsWithRooms };
  }

  static async findByUserId(userId: string): Promise<Project[]> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
      [userId]
    );
    
    return rows;
  }

  static async findByIdAndUserId(id: string, userId: string): Promise<Project | null> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId]
    );
    
    return rows[0] || null;
  }

  static async update(id: string, data: Partial<Project>): Promise<Project | null> {
    const fields: string[] = [];
    const values: (string | number | boolean | Date | null)[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.city !== undefined) {
      fields.push('city = ?');
      values.push(data.city);
    }
    if (data.use_ai_pricing !== undefined) {
      fields.push('use_ai_pricing = ?');
      values.push(data.use_ai_pricing);
    }
    if (data.last_ai_price_update !== undefined) {
      fields.push('last_ai_price_update = ?');
      values.push(data.last_ai_price_update);
    }
    if (data.version !== undefined) {
      fields.push('version = ?');
      values.push(data.version);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    
    await execute(
      `UPDATE projects SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    // Сначала мягкое удаление всех объектов проекта
    await execute(
      'UPDATE objects SET deleted_at = CURRENT_TIMESTAMP WHERE project_id = ? AND deleted_at IS NULL',
      [id]
    );

    // Затем мягкое удаление всех комнат проекта (на случай если объекты уже удалены)
    await execute(
      'UPDATE rooms SET deleted_at = CURRENT_TIMESTAMP WHERE project_id = ? AND deleted_at IS NULL',
      [id]
    );

    // И наконец удаление самого проекта
    const result = await execute(
      'UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    return result.affectedRows > 0;
  }

  // Full project with rooms (for sync)
  static async findFullProject(id: string, userId: string): Promise<(Project & { rooms: Room[] }) | null> {
    const project = await this.findByIdAndUserId(id, userId);
    if (!project) return null;

    const rooms = await query<(Room & RowDataPacket)[]>(
      `SELECT * FROM rooms WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
      [id]
    );

    return { ...project, rooms };
  }

  // Get all projects with rooms for sync
  // DEPRECATED: Используется для обратной совместимости
  static async findAllByUserIdForSync(userId: string): Promise<(Project & { rooms: Room[] })[]> {
    const projects = await this.findByUserId(userId);

    const result = await Promise.all(
      projects.map(async (project) => {
        // Для обратной совместимости загружаем комнаты из первого объекта
        const objects = await query<(any & RowDataPacket)[]>(
          `SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [project.id]
        );
        
        let rooms: Room[] = [];
        if (objects.length > 0) {
          // Загружаем комнаты из всех объектов
          for (const obj of objects) {
            const objRooms = await query<(Room & RowDataPacket)[]>(
              `SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
              [obj.id]
            );
            rooms = rooms.concat(objRooms);
          }
        }
        
        return { ...project, rooms };
      })
    );

    return result;
  }

  // Get all projects with objects for sync (new method)
  static async findAllByUserIdWithObjects(userId: string): Promise<ProjectWithObjects[]> {
    const projects = await this.findByUserId(userId);

    const result = await Promise.all(
      projects.map(async (project) => {
        const objects = await query<(Object & RowDataPacket)[]>(
          `SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [project.id]
        );
        
        const objectsWithRooms = await Promise.all(
          objects.map(async (obj) => {
            const rooms = await query<(Room & RowDataPacket)[]>(
              `SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
              [obj.id]
            );
            return { ...obj, rooms };
          })
        );
        
        return { ...project, objects: objectsWithRooms };
      })
    );

    return result;
  }

  /**
   * Update project and its rooms in a single transaction
   * This ensures atomic updates when both project and rooms are modified
   */
  static async updateWithRooms(
    projectId: string,
    userId: string,
    projectData: Partial<Project>,
    roomsData: Room[]
  ): Promise<ProjectWithRooms> {
    return transaction(async (conn) => {
      // Verify ownership
      const existingRows = await conn.query<(Project & RowDataPacket)[]>(
        'SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [projectId, userId]
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
          values
        );
      }

      // Update rooms - mark all existing rooms for potential deletion
      const roomIds = roomsData.map(r => r.id);
      
      if (roomIds.length > 0) {
        // Soft delete rooms that are not in the new list
        const placeholders = roomIds.map(() => '?').join(',');
        await conn.execute(
          `UPDATE rooms SET deleted_at = CURRENT_TIMESTAMP 
           WHERE project_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
          [projectId, ...roomIds]
        );
      } else {
        // No rooms - delete all
        await conn.execute(
          'UPDATE rooms SET deleted_at = CURRENT_TIMESTAMP WHERE project_id = ? AND deleted_at IS NULL',
          [projectId]
        );
      }

      // Update or create each room
      for (const room of roomsData) {
        // Check if room exists
        const existingRoomRows = await conn.query<(Room & RowDataPacket)[]>(
          'SELECT * FROM rooms WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
          [room.id, projectId]
        );

        if (existingRoomRows[0]) {
          // Update existing room
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
          // JSON fields
          if (room.segments !== undefined) {
            roomFields.push('segments = ?');
            roomValues.push(JSON.stringify(room.segments));
          }
          if (room.obstacles !== undefined) {
            roomFields.push('obstacles = ?');
            roomValues.push(JSON.stringify(room.obstacles));
          }
          if (room.wall_sections !== undefined) {
            roomFields.push('wall_sections = ?');
            roomValues.push(JSON.stringify(room.wall_sections));
          }
          if (room.sub_sections !== undefined) {
            roomFields.push('sub_sections = ?');
            roomValues.push(JSON.stringify(room.sub_sections));
          }
          if (room.windows !== undefined) {
            roomFields.push('windows = ?');
            roomValues.push(JSON.stringify(room.windows));
          }
          if (room.doors !== undefined) {
            roomFields.push('doors = ?');
            roomValues.push(JSON.stringify(room.doors));
          }
          if (room.works !== undefined) {
            roomFields.push('works = ?');
            roomValues.push(JSON.stringify(room.works));
          }

          if (roomFields.length > 0) {
            roomValues.push(room.id);
            await conn.execute(
              `UPDATE rooms SET ${roomFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              roomValues
            );
          }
        } else {
          // Create new room
          const maxOrderResult = await conn.query<(RowDataPacket & { max_order: number | null })[]>(
            'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM rooms WHERE project_id = ?',
            [projectId]
          );
          const sortOrder = (maxOrderResult[0][0]?.max_order ?? -1) + 1;

          await conn.execute(
            `INSERT INTO rooms (id, project_id, name, geometry_mode, length, width, height, sort_order,
              segments, obstacles, wall_sections, sub_sections, windows, doors, works)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              room.id || uuidv4(),
              projectId,
              room.name || 'Новая комната',
              room.geometry_mode || 'simple',
              room.length || 0,
              room.width || 0,
              room.height || 0,
              sortOrder,
              room.segments || null,
              room.obstacles || null,
              room.wall_sections || null,
              room.sub_sections || null,
              room.windows || null,
              room.doors || null,
              room.works || null
            ]
          );
        }
      }

      // Return updated project
      const updated = await this.findById(projectId);
      if (!updated) throw new Error('Project not found after update');

      const roomsResult = await conn.query<(Room & RowDataPacket)[]>(
        `SELECT * FROM rooms WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
        [projectId]
      );

      return { ...updated, rooms: roomsResult[0] };
    });
  }

  /**
   * Update project with multiple objects in a transaction
   */
  static async updateWithObjects(
    projectId: string,
    userId: string,
    projectData: Partial<Project>,
    objectsData: any[]
  ): Promise<ProjectWithObjects> {
    return transaction(async (conn) => {
      // Verify ownership
      const existingRows = await conn.query<(Project & RowDataPacket)[]>(
        'SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [projectId, userId]
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
          values
        );
      }

      // Get existing objects
      const existingObjectsResult = await conn.query<(any & RowDataPacket)[]>(
        'SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL',
        [projectId]
      );
      const existingObjects = existingObjectsResult[0] || [];

      // Get object IDs from request
      const objectIds = objectsData.map(o => o.id).filter(Boolean);

      // Soft delete objects not in the request
      if (objectIds.length > 0) {
        const placeholders = objectIds.map(() => '?').join(',');
        await conn.execute(
          `UPDATE objects SET deleted_at = CURRENT_TIMESTAMP
           WHERE project_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
          [projectId, ...objectIds]
        );
      } else if (objectsData.length > 0) {
        // No IDs provided but objects exist - delete all existing
        await conn.execute(
          'UPDATE objects SET deleted_at = CURRENT_TIMESTAMP WHERE project_id = ? AND deleted_at IS NULL',
          [projectId]
        );
      }

      // Update or create each object
      for (const objData of objectsData) {
        let objectId: string;

        if (objData.id) {
          // Check if object exists
          const existingObjResult = await conn.query<(any & RowDataPacket)[]>(
            'SELECT * FROM objects WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
            [objData.id, projectId]
          );

          if (existingObjResult[0]) {
            // Update existing object
            objectId = objData.id;
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
                objValues
              );
            }
          } else {
            // Create new object with new ID
            objectId = uuidv4();
            await conn.execute(
              `INSERT INTO objects (id, project_id, user_id, name, city, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
              [objectId, projectId, userId, objData.name || '', objData.city || null, objData.sort_order || 0]
            );
          }
        } else {
          // Create new object
          objectId = uuidv4();
          await conn.execute(
            `INSERT INTO objects (id, project_id, user_id, name, city, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
            [objectId, projectId, userId, objData.name || '', objData.city || null, objData.sort_order || 0]
          );
        }

        // Update rooms for this object
        if (objData.rooms && objData.rooms.length > 0) {
          const roomIds = objData.rooms.map((r: any) => r.id);

          // Soft delete rooms not in the request for this object
          if (roomIds.length > 0) {
            const placeholders = roomIds.map(() => '?').join(',');
            await conn.execute(
              `UPDATE rooms SET deleted_at = CURRENT_TIMESTAMP
               WHERE object_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
              [objectId, ...roomIds]
            );
          } else {
            await conn.execute(
              'UPDATE rooms SET deleted_at = CURRENT_TIMESTAMP WHERE object_id = ? AND deleted_at IS NULL',
              [objectId]
            );
          }

          // Update or create each room
          for (const room of objData.rooms) {
            if (room.id) {
              // Check if room exists
              const existingRoomResult = await conn.query<(Room & RowDataPacket)[]>(
                'SELECT * FROM rooms WHERE id = ? AND object_id = ? AND deleted_at IS NULL',
                [room.id, objectId]
              );

              if (existingRoomResult[0]) {
                // Update existing room
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
                  roomValues.push(room.id, objectId);
                  await conn.execute(
                    `UPDATE rooms SET ${roomFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND object_id = ?`,
                    roomValues
                  );
                }
              } else {
                // Room ID provided but not found - create new with provided ID
                await conn.execute(
                  `INSERT INTO rooms (id, object_id, project_id, name, geometry_mode, length, width, height, segments, obstacles, wall_sections, sub_sections, windows, doors, works, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    room.id, objectId, projectId, room.name || 'Комната', room.geometry_mode || 'simple',
                    room.length ?? 0, room.width ?? 0, room.height ?? 0,
                    JSON.stringify(room.segments ?? []),
                    JSON.stringify(room.obstacles ?? []),
                    JSON.stringify(room.wall_sections ?? []),
                    JSON.stringify(room.sub_sections ?? []),
                    JSON.stringify(room.windows ?? []),
                    JSON.stringify(room.doors ?? []),
                    JSON.stringify(room.works ?? []),
                    room.sort_order ?? 0
                  ]
                );
              }
            } else {
              // Create new room
              const roomId = uuidv4();
              await conn.execute(
                `INSERT INTO rooms (id, object_id, project_id, name, geometry_mode, length, width, height, segments, obstacles, wall_sections, sub_sections, windows, doors, works, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  roomId, objectId, projectId, room.name || 'Комната', room.geometry_mode || 'simple',
                  room.length ?? 0, room.width ?? 0, room.height ?? 0,
                  JSON.stringify(room.segments ?? []),
                  JSON.stringify(room.obstacles ?? []),
                  JSON.stringify(room.wall_sections ?? []),
                  JSON.stringify(room.sub_sections ?? []),
                  JSON.stringify(room.windows ?? []),
                  JSON.stringify(room.doors ?? []),
                  JSON.stringify(room.works ?? []),
                  room.sort_order ?? 0
                ]
              );
            }
          }
        }
      }

      // Return updated project with objects
      const updated = await this.findById(projectId);
      if (!updated) throw new Error('Project not found after update');

      const objectsResult = await conn.query<(any & RowDataPacket)[]>(
        'SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order',
        [projectId]
      );

      const objects = objectsResult[0] || [];
      const objectsWithRooms = await Promise.all(
        objects.map(async (obj: any) => {
          const roomsResult = await conn.query<(Room & RowDataPacket)[]>(
            'SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order',
            [obj.id]
          );
          return { ...obj, rooms: roomsResult[0] || [] };
        })
      );

      return { ...updated, objects: objectsWithRooms };
    });
  }
}