import { execute, getConnection, query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type { Room } from '../../types/index.js';
import { findRoomById } from './roomRead.js';

// ═══════════════════════════════════════════════════════
// ЗАПИСЬ КОМНАТ (вынесено из room.repo.ts)
// ═══════════════════════════════════════════════════════

/**
 * Создание комнаты (обёртка для обратной совместимости)
 * @deprecated Используйте createRoomForObject
 */
export async function createRoom(projectId: string, data: Partial<Room>): Promise<Room> {
  // Для обратной совместимости — создаём в первый объект проекта
  const objects = await query<any[]>(
    'SELECT id FROM objects WHERE project_id = ? AND deleted_at IS NULL LIMIT 1',
    [projectId],
  );

  const objectId = objects[0]?.id || projectId;
  return createRoomForObject(objectId, data);
}

/** Создание комнаты в объекте. */
export async function createRoomForObject(objectId: string, data: Partial<Room>): Promise<Room> {
  const id = uuidv4();

  // Get project_id from object
  const objectRows = await query<(RowDataPacket & { project_id: string })[]>(
    'SELECT project_id FROM objects WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [objectId],
  );
  const projectId = objectRows[0]?.project_id;
  if (!projectId) {
    throw new Error('Object not found');
  }

  // Get max sort_order
  const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM rooms WHERE object_id = ?',
    [objectId],
  );
  const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

  await execute(
    `INSERT INTO rooms (id, object_id, project_id, name, geometry_mode, length, width, height, sort_order,
        segments, obstacles, wall_sections, sub_sections, windows, doors, works,
        simple_mode_data, extended_mode_data, advanced_mode_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      objectId,
      projectId,
      data.name || 'Новая комната',
      data.geometry_mode || 'simple',
      data.length || 0,
      data.width || 0,
      data.height || 0,
      sortOrder,
      data.segments || null,
      data.obstacles || null,
      data.wall_sections || null,
      data.sub_sections || null,
      data.windows || null,
      data.doors || null,
      data.works || null,
      data.simple_mode_data || null,
      data.extended_mode_data || null,
      data.advanced_mode_data || null,
    ],
  );

  const room = await findRoomById(id);
  return room!;
}

export async function updateRoom(id: string, data: Partial<Room>): Promise<Room | null> {
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
  // JSON fields
  if (data.segments !== undefined) {
    fields.push('segments = ?');
    values.push(data.segments);
  }
  if (data.obstacles !== undefined) {
    fields.push('obstacles = ?');
    values.push(data.obstacles);
  }
  if (data.wall_sections !== undefined) {
    fields.push('wall_sections = ?');
    values.push(data.wall_sections);
  }
  if (data.sub_sections !== undefined) {
    fields.push('sub_sections = ?');
    values.push(data.sub_sections);
  }
  if (data.windows !== undefined) {
    fields.push('windows = ?');
    values.push(data.windows);
  }
  if (data.doors !== undefined) {
    fields.push('doors = ?');
    values.push(data.doors);
  }
  if (data.works !== undefined) {
    fields.push('works = ?');
    values.push(data.works);
  }
  if (data.simple_mode_data !== undefined) {
    fields.push('simple_mode_data = ?');
    values.push(data.simple_mode_data);
  }
  if (data.extended_mode_data !== undefined) {
    fields.push('extended_mode_data = ?');
    values.push(data.extended_mode_data);
  }
  if (data.advanced_mode_data !== undefined) {
    fields.push('advanced_mode_data = ?');
    values.push(data.advanced_mode_data);
  }

  if (fields.length === 0) {
    return findRoomById(id);
  }

  values.push(id);

  await execute(
    `UPDATE rooms SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    values,
  );

  return findRoomById(id);
}

export async function deleteRoom(id: string): Promise<boolean> {
  const result = await execute(
    'UPDATE rooms SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
    [id],
  );

  return result.affectedRows > 0;
}

export async function reorderRooms(projectId: string, roomIds: string[]): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    for (let i = 0; i < roomIds.length; i++) {
      const roomId = roomIds[i];
      if (roomId) {
        await conn.execute('UPDATE rooms SET sort_order = ? WHERE id = ? AND project_id = ?', [
          i,
          roomId,
          projectId,
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
