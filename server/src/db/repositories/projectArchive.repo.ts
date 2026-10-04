import { query, transaction } from '../pool.js';
import type { Project, Room, DbObject as Object, ProjectWithObjects } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from '../pool.js';

export type RestoreResult =
  | { status: 'restored'; project: ProjectWithObjects }
  | { status: 'not_found' }
  | { status: 'not_archived' };

export type HardDeleteResult =
  | { status: 'deleted'; deleted: { objects: number; rooms: number } }
  | { status: 'not_found' }
  | { status: 'not_archived' };

/**
 * Архивные операции над проектами (P3-SPLIT): список архива, restore,
 * безвозвратное удаление, кандидаты на cleanup. Вынесено из ProjectRepository
 * (project.repo.ts); оттуда же ре-экспортируется для совместимости импортёров.
 */
export class ProjectArchiveRepository {
  static async findArchivedByUserId(
    userId: string,
  ): Promise<(Project & { objectsCount: number; roomsCount: number })[]> {
    const rows = await query<
      (Project & RowDataPacket & { objects_count: string | number; rooms_count: string | number })[]
    >(
      `SELECT p.*,
        (SELECT COUNT(*) FROM objects o WHERE o.project_id = p.id) AS objects_count,
        (SELECT COUNT(*) FROM rooms r WHERE r.project_id = p.id) AS rooms_count
      FROM projects p
      WHERE p.user_id = ? AND p.deleted_at IS NOT NULL
      ORDER BY p.deleted_at DESC`,
      [userId],
    );

    return rows.map(row => {
      const { objects_count, rooms_count, ...project } = row;
      return {
        ...project,
        // PG возвращает COUNT как строку — приводим к числу
        objectsCount: Number(objects_count),
        roomsCount: Number(rooms_count),
      };
    });
  }

  static async findArchivedByIdAndUserId(id: string, userId: string): Promise<Project | null> {
    const rows = await query<(Project & RowDataPacket & { deleted_at: Date | null })[]>(
      `SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [id, userId],
    );

    return rows[0] || null;
  }

  /**
   * Восстановление проекта из архива.
   * Дети воскрешаются только по совпадению штампа с проектом: сравнение колонка-
   * с-колонкой через subquery, НЕ JS Date параметром (pg timestamptz хранит
   * микросекунды, JS Date округляет до мс — параметр не совпадёт).
   */
  static async restore(id: string, userId: string): Promise<RestoreResult> {
    const rows = await query<(Project & RowDataPacket & { deleted_at: Date | null })[]>(
      `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
      [id, userId],
    );

    const project = rows[0];
    if (!project) return { status: 'not_found' };
    if (project.deleted_at == null) return { status: 'not_archived' };

    await transaction(async conn => {
      // Subquery читает ещё архивный проект — снятие штампа проекта выполняется ПОСЛЕДНИМ
      await conn.execute(
        `UPDATE objects SET deleted_at = NULL
         WHERE project_id = ? AND deleted_at = (SELECT deleted_at FROM projects WHERE id = ?)`,
        [id, id],
      );

      await conn.execute(
        `UPDATE rooms SET deleted_at = NULL
         WHERE project_id = ? AND deleted_at = (SELECT deleted_at FROM projects WHERE id = ?)`,
        [id, id],
      );

      await conn.execute(
        `UPDATE projects SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id],
      );
    });

    const restored = await this.fetchProjectWithObjects(id, userId);
    if (!restored) return { status: 'not_found' };
    return { status: 'restored', project: restored };
  }

  /**
   * Кандидаты на постоянное удаление (§15.2.0 ТЗ v1.1): архивные проекты
   * (deleted_at IS NOT NULL), заархивированные раньше cutoff.
   * Пары (id, userId) достаточно для hardDelete; гонка с параллельным restore
   * гасится повторной проверкой deleted_at внутри транзакции hardDelete.
   */
  static async findArchivedOlderThan(cutoff: Date): Promise<{ id: string; userId: string }[]> {
    const rows = await query<(RowDataPacket & { id: string; user_id: string })[]>(
      `SELECT id, user_id FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < ?`,
      [cutoff],
    );

    return rows.map(row => ({ id: row.id, userId: row.user_id }));
  }

  /**
   * Полное удаление проекта из БД — единственный real-DELETE (дети уходят по FK CASCADE).
   * Только для архивного проекта; счётчики считаются ДО DELETE; запись в audit_log там же.
   */
  static async hardDelete(id: string, userId: string): Promise<HardDeleteResult> {
    return transaction(async conn => {
      const [projectRows] = await conn.query<
        (Project & RowDataPacket & { deleted_at: Date | null })[]
      >(`SELECT * FROM projects WHERE id = ? AND user_id = ?`, [id, userId]);

      const project = projectRows[0];
      if (!project) return { status: 'not_found' };
      if (project.deleted_at == null) return { status: 'not_archived' };

      // Счётчики ДО DELETE: каскад уничтожит строки, считать после невозможно
      const [objectsRows] = await conn.query<(RowDataPacket & { count: string | number })[]>(
        `SELECT COUNT(*) as count FROM objects WHERE project_id = ?`,
        [id],
      );
      const [roomsRows] = await conn.query<(RowDataPacket & { count: string | number })[]>(
        `SELECT COUNT(*) as count FROM rooms WHERE project_id = ?`,
        [id],
      );

      const objects = Number(objectsRows[0]?.count ?? 0);
      const rooms = Number(roomsRows[0]?.count ?? 0);

      // Единственный real-DELETE: дети удаляются FK CASCADE, вручную не трогаем
      await conn.execute(`DELETE FROM projects WHERE id = ?`, [id]);

      await conn.execute(
        `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'project.permanent_delete', 'project', ?, ?)`,
        [uuidv4(), userId, id, JSON.stringify({ name: project.name, objects, rooms })],
      );

      return { status: 'deleted', deleted: { objects, rooms } };
    });
  }

  /**
   * Проект с объектами и комнатами (только неархивные строки) — локальная копия
   * логики ProjectRepository.findByIdWithObjects: restore читает только что
   * разархивированный проект, классы не связаны наследованием/циклом.
   */
  private static async fetchProjectWithObjects(
    id: string,
    userId: string,
  ): Promise<ProjectWithObjects | null> {
    const projectRows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    const project = projectRows[0];
    if (!project) return null;

    const objects = await query<(Object & RowDataPacket)[]>(
      `SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
      [id],
    );

    const objectsWithRooms = await Promise.all(
      objects.map(async obj => {
        const rooms = await query<(Room & RowDataPacket)[]>(
          `SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [obj.id],
        );
        return { ...obj, rooms };
      }),
    );

    return { ...project, objects: objectsWithRooms };
  }
}
