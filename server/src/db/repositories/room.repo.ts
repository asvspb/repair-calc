import { query, execute, getConnection } from '../pool.js';
import type { Room, Opening, RoomSubSection, RoomSegment, Obstacle, WallSection, Work, Material, Tool } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';

export class RoomRepository {
  static async create(projectId: string, data: Partial<Room>): Promise<Room> {
    const id = uuidv4();
    
    // Get max sort_order
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM rooms WHERE project_id = ?',
      [projectId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO rooms (id, project_id, name, geometry_mode, length, width, height, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, data.name || 'Новая комната', data.geometry_mode || 'simple', data.length || 0, data.width || 0, data.height || 0, sortOrder]
    );
    
    const room = await this.findById(id);
    return room!;
  }

  static async findById(id: string): Promise<Room | null> {
    const rows = await query<(Room & RowDataPacket)[]>(
      'SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    return rows[0] || null;
  }

  static async findByProjectId(projectId: string): Promise<Room[]> {
    const rows = await query<(Room & RowDataPacket)[]>(
      'SELECT * FROM rooms WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [projectId]
    );
    
    return rows;
  }

  static async update(id: string, data: Partial<Room>): Promise<Room | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.geometry_mode !== undefined) {
      fields.push('geometry_mode = ?');
      values.push(data.geometry_mode);
    }
    if (data.length !== undefined) {
      fields.push('length = ?');
      values.push(data.length);
    }
    if (data.width !== undefined) {
      fields.push('width = ?');
      values.push(data.width);
    }
    if (data.height !== undefined) {
      fields.push('height = ?');
      values.push(data.height);
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
      `UPDATE rooms SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE rooms SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  static async reorder(projectId: string, roomIds: string[]): Promise<void> {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      
      for (let i = 0; i < roomIds.length; i++) {
        const roomId = roomIds[i];
        if (roomId) {
          await conn.execute(
            'UPDATE rooms SET sort_order = ? WHERE id = ? AND project_id = ?',
            [i, roomId, projectId]
          );
        }
      }
      
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // Full room with all relations
  static async findFullRoom(id: string): Promise<(Room & { 
    windows: Opening[]; 
    doors: Opening[];
    subSections: RoomSubSection[];
    segments: RoomSegment[];
    obstacles: Obstacle[];
    wallSections: WallSection[];
    works: (Work & { materials: Material[]; tools: Tool[] })[];
  }) | null> {
    const room = await this.findById(id);
    if (!room) return null;

    // Get openings
    const windows = await query<(Opening & RowDataPacket)[]>(
      "SELECT * FROM openings WHERE room_id = ? AND type = 'window' AND deleted_at IS NULL ORDER BY sort_order",
      [id]
    );
    const doors = await query<(Opening & RowDataPacket)[]>(
      "SELECT * FROM openings WHERE room_id = ? AND type = 'door' AND deleted_at IS NULL ORDER BY sort_order",
      [id]
    );

    // Get geometry for extended/advanced modes
    const subSections = await query<(RoomSubSection & RowDataPacket)[]>(
      'SELECT * FROM room_subsections WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [id]
    );
    const segments = await query<(RoomSegment & RowDataPacket)[]>(
      'SELECT * FROM room_segments WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [id]
    );
    const obstacles = await query<(Obstacle & RowDataPacket)[]>(
      'SELECT * FROM room_obstacles WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [id]
    );
    const wallSections = await query<(WallSection & RowDataPacket)[]>(
      'SELECT * FROM wall_sections WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [id]
    );

    // Get works with materials and tools
    const works = await query<(Work & RowDataPacket)[]>(
      'SELECT * FROM works WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [id]
    );

    const worksWithRelations = await Promise.all(
      works.map(async (work) => {
        const materials = await query<(Material & RowDataPacket)[]>(
          'SELECT * FROM materials WHERE work_id = ? AND deleted_at IS NULL ORDER BY sort_order',
          [work.id]
        );
        const tools = await query<(Tool & RowDataPacket)[]>(
          'SELECT * FROM tools WHERE work_id = ? AND deleted_at IS NULL ORDER BY sort_order',
          [work.id]
        );
        return { ...work, materials, tools };
      })
    );

    return { 
      ...room, 
      windows, 
      doors, 
      subSections, 
      segments, 
      obstacles, 
      wallSections, 
      works: worksWithRelations 
    };
  }
}