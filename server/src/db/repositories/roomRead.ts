import { query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import type { Room } from '../../types/index.js';

// ═══════════════════════════════════════════════════════
// ЧТЕНИЕ КОМНАТ (вынесено из room.repo.ts)
// ═══════════════════════════════════════════════════════

export async function findRoomById(id: string): Promise<Room | null> {
  const rows = await query<(Room & RowDataPacket)[]>(
    'SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL',
    [id],
  );

  return rows[0] || null;
}

export async function findRoomsByProjectId(projectId: string): Promise<Room[]> {
  const rows = await query<(Room & RowDataPacket)[]>(
    'SELECT * FROM rooms WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order',
    [projectId],
  );

  return rows;
}

/** Поиск комнаты с объектом (для проверки прав доступа). */
export async function findRoomByIdWithObject(
  id: string,
): Promise<(Room & { object_id: string }) | null> {
  const rows = await query<any[]>(
    'SELECT r.id, r.object_id, r.name, r.geometry_mode, r.length, r.width, r.height, ' +
      'r.version, r.sort_order, r.created_at, r.updated_at, ' +
      'r.segments, r.obstacles, r.wall_sections, r.sub_sections, ' +
      'r.windows, r.doors, r.works, ' +
      'r.simple_mode_data, r.extended_mode_data, r.advanced_mode_data ' +
      'FROM rooms r WHERE r.id = ? AND r.deleted_at IS NULL',
    [id],
  );

  return rows[0] || null;
}
