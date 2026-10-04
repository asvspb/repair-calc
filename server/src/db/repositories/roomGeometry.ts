import { execute, getConnection, query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type { Obstacle, RoomSegment, WallSection } from '../../types/index.js';

// ═══════════════════════════════════════════════════════
// SEGMENT REPOSITORY (Advanced Mode) — вынесено из room.repo.ts
// ═══════════════════════════════════════════════════════

export class SegmentRepository {
  static async create(roomId: string, data: Partial<RoomSegment>): Promise<RoomSegment> {
    const id = uuidv4();

    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM room_segments WHERE room_id = ?',
      [roomId],
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

    await execute(
      `INSERT INTO room_segments (id, room_id, name, length, width, operation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        roomId,
        data.name || null,
        data.length || 0,
        data.width || 0,
        data.operation || 'subtract',
        sortOrder,
      ],
    );

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<RoomSegment | null> {
    const rows = await query<(RoomSegment & RowDataPacket)[]>(
      'SELECT * FROM room_segments WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<RoomSegment[]> {
    return query<(RoomSegment & RowDataPacket)[]>(
      'SELECT * FROM room_segments WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId],
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
      [id],
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
            [i, segmentId, roomId],
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
// OBSTACLE REPOSITORY (Advanced Mode) — вынесено из room.repo.ts
// ═══════════════════════════════════════════════════════

export class ObstacleRepository {
  static async create(roomId: string, data: Partial<Obstacle>): Promise<Obstacle> {
    const id = uuidv4();

    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM room_obstacles WHERE room_id = ?',
      [roomId],
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

    await execute(
      `INSERT INTO room_obstacles (id, room_id, name, type, area, perimeter, operation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        roomId,
        data.name || null,
        data.type || 'column',
        data.area || 0,
        data.perimeter || 0,
        data.operation || 'subtract',
        sortOrder,
      ],
    );

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Obstacle | null> {
    const rows = await query<(Obstacle & RowDataPacket)[]>(
      'SELECT * FROM room_obstacles WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<Obstacle[]> {
    return query<(Obstacle & RowDataPacket)[]>(
      'SELECT * FROM room_obstacles WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId],
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
      [id],
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
            [i, obstacleId, roomId],
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
// WALL SECTION REPOSITORY (Advanced Mode) — вынесено из room.repo.ts
// ═══════════════════════════════════════════════════════

export class WallSectionRepository {
  static async create(roomId: string, data: Partial<WallSection>): Promise<WallSection> {
    const id = uuidv4();

    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM wall_sections WHERE room_id = ?',
      [roomId],
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

    await execute(
      `INSERT INTO wall_sections (id, room_id, name, length, height, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, roomId, data.name || null, data.length || 0, data.height || 0, sortOrder],
    );

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<WallSection | null> {
    const rows = await query<(WallSection & RowDataPacket)[]>(
      'SELECT * FROM wall_sections WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<WallSection[]> {
    return query<(WallSection & RowDataPacket)[]>(
      'SELECT * FROM wall_sections WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId],
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
      [id],
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
            [i, wallSectionId, roomId],
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
