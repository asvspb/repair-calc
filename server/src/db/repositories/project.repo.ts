import { execute, transaction } from '../pool.js';
import type { Project, ProjectWithObjects } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { ProjectUpdateObjectsRepository } from './projectUpdateObjects.repo.js';

// Ре-экспорт разнесённых репозиториев и типов для совместимости импортёров (P3-SPLIT):
// ProjectRepository наследует цепочку Archive → Read → UpdateRooms → UpdateObjects,
// поэтому вся прежняя поверхность API доступна через ProjectRepository как раньше.
export { ProjectArchiveRepository } from './projectArchive.repo.js';
export type { RestoreResult, HardDeleteResult } from './projectArchive.repo.js';
export { ProjectReadRepository } from './projectRead.repo.js';
export { ProjectUpdateRoomsRepository } from './projectUpdateRooms.repo.js';
export { ProjectUpdateObjectsRepository } from './projectUpdateObjects.repo.js';

export class ProjectRepository extends ProjectUpdateObjectsRepository {
  static async create(
    userId: string,
    data: { name: string; city?: string; use_ai_pricing?: boolean },
  ): Promise<ProjectWithObjects> {
    const id = uuidv4();
    const objectId = uuidv4();

    await transaction(async () => {
      // Создаём проект
      await execute(
        `INSERT INTO projects (id, user_id, name, city, use_ai_pricing) VALUES (?, ?, ?, ?, ?)`,
        [id, userId, data.name, data.city || null, data.use_ai_pricing || false],
      );

      // Создаём первый объект для проекта
      await execute(
        `INSERT INTO objects (id, project_id, user_id, name, city, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [objectId, id, userId, data.name, data.city || null, 0],
      );
    });

    const project = await this.findByIdWithObjects(id, userId);
    return project!;
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
      values,
    );

    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    // Единый JS-штамп: один экземпляр Date уходит параметром во все три UPDATE —
    // CURRENT_TIMESTAMP в разных запросах не гарантирует совпадения штампов,
    // а совпадение критично для restore (дети воскрешаются по штампу проекта).
    const archivedAt = new Date();

    return transaction(async conn => {
      // Сначала сам проект: если он уже архивный (affectedRows = 0) — no-op,
      // объекты/комнаты не трогаются (идемпотентность повторной архивации)
      const [projectResult] = await conn.execute(
        'UPDATE projects SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
        [archivedAt, id],
      );

      if (projectResult.affectedRows === 0) {
        return false;
      }

      // Мягкое удаление всех объектов проекта
      await conn.execute(
        'UPDATE objects SET deleted_at = ? WHERE project_id = ? AND deleted_at IS NULL',
        [archivedAt, id],
      );

      // Мягкое удаление всех комнат проекта (на случай если объекты уже удалены)
      await conn.execute(
        'UPDATE rooms SET deleted_at = ? WHERE project_id = ? AND deleted_at IS NULL',
        [archivedAt, id],
      );

      return true;
    });
  }
}
