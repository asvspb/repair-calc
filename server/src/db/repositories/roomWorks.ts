import { execute, getConnection, query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type { Opening, RoomSubSection } from '../../types/index.js';

// ═══════════════════════════════════════════════════════
// OPENING REPOSITORY (Windows & Doors) — вынесено из room.repo.ts
// ═══════════════════════════════════════════════════════

export class OpeningRepository {
  static async create(roomId: string, data: Partial<Opening>): Promise<Opening> {
    const id = uuidv4();

    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM openings WHERE room_id = ?',
      [roomId],
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

    await execute(
      `INSERT INTO openings (id, room_id, type, width, height, comment, subsection_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        roomId,
        data.type || 'window',
        data.width || 0,
        data.height || 0,
        data.comment || null,
        data.subsection_id || null,
        sortOrder,
      ],
    );

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Opening | null> {
    const rows = await query<(Opening & RowDataPacket)[]>(
      'SELECT * FROM openings WHERE id = ? AND deleted_at IS NULL',
      [id],
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
      [id],
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
          await conn.execute('UPDATE openings SET sort_order = ? WHERE id = ? AND room_id = ?', [
            i,
            openingId,
            roomId,
          ]);
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
// SUBSECTION REPOSITORY (Extended Mode) — вынесено из room.repo.ts
// ═══════════════════════════════════════════════════════

export class SubSectionRepository {
  static async create(roomId: string, data: Partial<RoomSubSection>): Promise<RoomSubSection> {
    const id = uuidv4();

    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM room_subsections WHERE room_id = ?',
      [roomId],
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

    await execute(
      `INSERT INTO room_subsections (id, room_id, name, shape, length, width, base1, base2, depth, side1, side2, side_a, side_b, side_c, base, side, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        roomId,
        data.name || null,
        data.shape || 'rectangle',
        data.length || 0,
        data.width || 0,
        data.base1 || null,
        data.base2 || null,
        data.depth || null,
        data.side1 || null,
        data.side2 || null,
        data.side_a || null,
        data.side_b || null,
        data.side_c || null,
        data.base || null,
        data.side || null,
        sortOrder,
      ],
    );

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<RoomSubSection | null> {
    const rows = await query<(RoomSubSection & RowDataPacket)[]>(
      'SELECT * FROM room_subsections WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<RoomSubSection[]> {
    return query<(RoomSubSection & RowDataPacket)[]>(
      'SELECT * FROM room_subsections WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId],
    );
  }

  static async update(id: string, data: Partial<RoomSubSection>): Promise<RoomSubSection | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = [
      'name',
      'shape',
      'length',
      'width',
      'base1',
      'base2',
      'depth',
      'side1',
      'side2',
      'side_a',
      'side_b',
      'side_c',
      'base',
      'side',
      'version',
    ] as const;

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
      [id],
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
            [i, subsectionId, roomId],
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
