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

// ═══════════════════════════════════════════════════════
// OPENING REPOSITORY (Windows & Doors)
// ═══════════════════════════════════════════════════════

export class OpeningRepository {
  static async create(roomId: string, data: Partial<Opening>): Promise<Opening> {
    const id = uuidv4();
    
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM openings WHERE room_id = ?',
      [roomId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO openings (id, room_id, type, width, height, comment, subsection_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, roomId, data.type || 'window', data.width || 0, data.height || 0, data.comment || null, data.subsection_id || null, sortOrder]
    );
    
    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Opening | null> {
    const rows = await query<(Opening & RowDataPacket)[]>(
      'SELECT * FROM openings WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string, type?: 'window' | 'door'): Promise<Opening[]> {
    let sql = 'SELECT * FROM openings WHERE room_id = ? AND deleted_at IS NULL';
    const params: string[] = [roomId];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY sort_order';
    
    return query<(Opening & RowDataPacket)[]>(sql, params);
  }

  static async update(id: string, data: Partial<Opening>): Promise<Opening | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.type !== undefined) {
      fields.push('type = ?');
      values.push(data.type);
    }
    if (data.width !== undefined) {
      fields.push('width = ?');
      values.push(data.width);
    }
    if (data.height !== undefined) {
      fields.push('height = ?');
      values.push(data.height);
    }
    if (data.comment !== undefined) {
      fields.push('comment = ?');
      values.push(data.comment);
    }
    if (data.subsection_id !== undefined) {
      fields.push('subsection_id = ?');
      values.push(data.subsection_id);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await execute(`UPDATE openings SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE openings SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async reorder(roomId: string, openingIds: string[]): Promise<void> {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      
      for (let i = 0; i < openingIds.length; i++) {
        const openingId = openingIds[i];
        if (openingId) {
          await conn.execute(
            'UPDATE openings SET sort_order = ? WHERE id = ? AND room_id = ?',
            [i, openingId, roomId]
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
}

// ═══════════════════════════════════════════════════════
// SUBSECTION REPOSITORY (Extended Mode)
// ═══════════════════════════════════════════════════════

export class SubSectionRepository {
  static async create(roomId: string, data: Partial<RoomSubSection>): Promise<RoomSubSection> {
    const id = uuidv4();
    
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM room_subsections WHERE room_id = ?',
      [roomId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO room_subsections (id, room_id, name, shape, length, width, base1, base2, depth, side1, side2, side_a, side_b, side_c, base, side, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, roomId, data.name || null, data.shape || 'rectangle',
        data.length || 0, data.width || 0, data.base1 || null, data.base2 || null,
        data.depth || null, data.side1 || null, data.side2 || null,
        data.side_a || null, data.side_b || null, data.side_c || null,
        data.base || null, data.side || null, sortOrder
      ]
    );
    
    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<RoomSubSection | null> {
    const rows = await query<(RoomSubSection & RowDataPacket)[]>(
      'SELECT * FROM room_subsections WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<RoomSubSection[]> {
    return query<(RoomSubSection & RowDataPacket)[]>(
      'SELECT * FROM room_subsections WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId]
    );
  }

  static async update(id: string, data: Partial<RoomSubSection>): Promise<RoomSubSection | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = ['name', 'shape', 'length', 'width', 'base1', 'base2', 
      'depth', 'side1', 'side2', 'side_a', 'side_b', 'side_c', 'base', 'side', 'version'] as const;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field] as string | number | null);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await execute(`UPDATE room_subsections SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE room_subsections SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async reorder(roomId: string, subsectionIds: string[]): Promise<void> {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      
      for (let i = 0; i < subsectionIds.length; i++) {
        const subsectionId = subsectionIds[i];
        if (subsectionId) {
          await conn.execute(
            'UPDATE room_subsections SET sort_order = ? WHERE id = ? AND room_id = ?',
            [i, subsectionId, roomId]
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
}

// ═══════════════════════════════════════════════════════
// SEGMENT REPOSITORY (Advanced Mode)
// ═══════════════════════════════════════════════════════

export class SegmentRepository {
  static async create(roomId: string, data: Partial<RoomSegment>): Promise<RoomSegment> {
    const id = uuidv4();
    
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM room_segments WHERE room_id = ?',
      [roomId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO room_segments (id, room_id, name, length, width, operation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, roomId, data.name || null, data.length || 0, data.width || 0, data.operation || 'subtract', sortOrder]
    );
    
    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<RoomSegment | null> {
    const rows = await query<(RoomSegment & RowDataPacket)[]>(
      'SELECT * FROM room_segments WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<RoomSegment[]> {
    return query<(RoomSegment & RowDataPacket)[]>(
      'SELECT * FROM room_segments WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId]
    );
  }

  static async update(id: string, data: Partial<RoomSegment>): Promise<RoomSegment | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = ['name', 'length', 'width', 'operation', 'version'] as const;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field] as string | number | null);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await execute(`UPDATE room_segments SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE room_segments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async reorder(roomId: string, segmentIds: string[]): Promise<void> {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      
      for (let i = 0; i < segmentIds.length; i++) {
        const segmentId = segmentIds[i];
        if (segmentId) {
          await conn.execute(
            'UPDATE room_segments SET sort_order = ? WHERE id = ? AND room_id = ?',
            [i, segmentId, roomId]
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
}

// ═══════════════════════════════════════════════════════
// OBSTACLE REPOSITORY (Advanced Mode)
// ═══════════════════════════════════════════════════════

export class ObstacleRepository {
  static async create(roomId: string, data: Partial<Obstacle>): Promise<Obstacle> {
    const id = uuidv4();
    
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM room_obstacles WHERE room_id = ?',
      [roomId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO room_obstacles (id, room_id, name, type, area, perimeter, operation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, roomId, data.name || null, data.type || 'column', data.area || 0, data.perimeter || 0, data.operation || 'subtract', sortOrder]
    );
    
    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Obstacle | null> {
    const rows = await query<(Obstacle & RowDataPacket)[]>(
      'SELECT * FROM room_obstacles WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<Obstacle[]> {
    return query<(Obstacle & RowDataPacket)[]>(
      'SELECT * FROM room_obstacles WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId]
    );
  }

  static async update(id: string, data: Partial<Obstacle>): Promise<Obstacle | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = ['name', 'type', 'area', 'perimeter', 'operation', 'version'] as const;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field] as string | number | null);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await execute(`UPDATE room_obstacles SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE room_obstacles SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async reorder(roomId: string, obstacleIds: string[]): Promise<void> {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      
      for (let i = 0; i < obstacleIds.length; i++) {
        const obstacleId = obstacleIds[i];
        if (obstacleId) {
          await conn.execute(
            'UPDATE room_obstacles SET sort_order = ? WHERE id = ? AND room_id = ?',
            [i, obstacleId, roomId]
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
}

// ═══════════════════════════════════════════════════════
// WALL SECTION REPOSITORY (Advanced Mode)
// ═══════════════════════════════════════════════════════

export class WallSectionRepository {
  static async create(roomId: string, data: Partial<WallSection>): Promise<WallSection> {
    const id = uuidv4();
    
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM wall_sections WHERE room_id = ?',
      [roomId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO wall_sections (id, room_id, name, length, height, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, roomId, data.name || null, data.length || 0, data.height || 0, sortOrder]
    );
    
    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<WallSection | null> {
    const rows = await query<(WallSection & RowDataPacket)[]>(
      'SELECT * FROM wall_sections WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<WallSection[]> {
    return query<(WallSection & RowDataPacket)[]>(
      'SELECT * FROM wall_sections WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId]
    );
  }

  static async update(id: string, data: Partial<WallSection>): Promise<WallSection | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = ['name', 'length', 'height', 'version'] as const;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field] as string | number | null);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await execute(`UPDATE wall_sections SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE wall_sections SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async reorder(roomId: string, wallSectionIds: string[]): Promise<void> {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      
      for (let i = 0; i < wallSectionIds.length; i++) {
        const wallSectionId = wallSectionIds[i];
        if (wallSectionId) {
          await conn.execute(
            'UPDATE wall_sections SET sort_order = ? WHERE id = ? AND room_id = ?',
            [i, wallSectionId, roomId]
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
}
