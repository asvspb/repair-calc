import { query } from '../pool.js';
import type { Project, Room, DbObject as Object, ProjectWithObjects } from '../../types/index.js';
import type { RowDataPacket } from '../pool.js';
import { ProjectArchiveRepository } from './projectArchive.repo.js';

/**
 * Чтение проектов (P3-SPLIT): одиночный проект, список пользователя, варианты
 * для синхронизации. Вынесено из ProjectRepository (project.repo.ts); sitца
 * update-классов вызывают this.findById, поэтому reads — их предок в цепочке.
 */
export class ProjectReadRepository extends ProjectArchiveRepository {
  static async findById(id: string): Promise<Project | null> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );

    return rows[0] || null;
  }

  static async findByIdWithObjects(id: string, userId: string): Promise<ProjectWithObjects | null> {
    const project = await this.findByIdAndUserId(id, userId);
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

  static async findByUserId(userId: string): Promise<Project[]> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
      [userId],
    );

    return rows;
  }

  static async findByIdAndUserId(id: string, userId: string): Promise<Project | null> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );

    return rows[0] || null;
  }

  // Full project with rooms (for sync)
  static async findFullProject(
    id: string,
    userId: string,
  ): Promise<(Project & { rooms: Room[] }) | null> {
    const project = await this.findByIdAndUserId(id, userId);
    if (!project) return null;

    const rooms = await query<(Room & RowDataPacket)[]>(
      `SELECT * FROM rooms WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
      [id],
    );

    return { ...project, rooms };
  }

  // Get all projects with rooms for sync
  // DEPRECATED: Используется для обратной совместимости
  static async findAllByUserIdForSync(userId: string): Promise<(Project & { rooms: Room[] })[]> {
    const projects = await this.findByUserId(userId);

    const result = await Promise.all(
      projects.map(async project => {
        // Для обратной совместимости загружаем комнаты из первого объекта
        const objects = await query<(any & RowDataPacket)[]>(
          `SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [project.id],
        );

        let rooms: Room[] = [];
        if (objects.length > 0) {
          // Загружаем комнаты из всех объектов
          for (const obj of objects) {
            const objRooms = await query<(Room & RowDataPacket)[]>(
              `SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
              [obj.id],
            );
            rooms = rooms.concat(objRooms);
          }
        }

        return { ...project, rooms };
      }),
    );

    return result;
  }

  // Get all projects with objects for sync (new method)
  static async findAllByUserIdWithObjects(userId: string): Promise<ProjectWithObjects[]> {
    const projects = await this.findByUserId(userId);

    const result = await Promise.all(
      projects.map(async project => {
        const objects = await query<(Object & RowDataPacket)[]>(
          `SELECT * FROM objects WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [project.id],
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
      }),
    );

    return result;
  }
}
