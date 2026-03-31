import { query, execute } from '../pool.js';
import type { Object, ObjectWithRooms } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Репозиторий для работы с объектами недвижимости
 * Объект — единица недвижимости в составе проекта (квартира, дом, офис)
 */
export class ObjectRepository {
  /**
   * Создание нового объекта
   */
  static async create(
    projectId: string,
    userId: string,
    data: {
      name: string;
      city?: string | null;
      address?: string | null;
      use_ai_pricing?: boolean;
    }
  ): Promise<Object> {
    const id = uuidv4();

    await execute(
      `INSERT INTO objects (
        id, project_id, user_id, name, city, address, 
        use_ai_pricing, version, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        id,
        projectId,
        userId,
        data.name,
        data.city || null,
        data.address || null,
        data.use_ai_pricing || false,
      ]
    );

    const rows = await query<(Object & RowDataPacket)[]>(
      'SELECT * FROM objects WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    return rows[0]!;
  }

  /**
   * Поиск объекта по ID
   */
  static async findById(id: string): Promise<Object | null> {
    const rows = await query<(Object & RowDataPacket)[]>(
      'SELECT * FROM objects WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    return rows[0] || null;
  }

  /**
   * Поиск объекта с комнатами по ID
   */
  static async findByIdWithRooms(id: string): Promise<ObjectWithRooms | null> {
    const object = await this.findById(id);
    if (!object) return null;

    const rooms = await query<(any & RowDataPacket)[]>(
      `SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
      [object.id]
    );

    return { ...object, rooms };
  }

  /**
   * Поиск всех объектов проекта
   */
  static async findByProjectId(projectId: string): Promise<Object[]> {
    const rows = await query<(Object & RowDataPacket)[]>(
      `SELECT * FROM objects 
       WHERE project_id = ? AND deleted_at IS NULL 
       ORDER BY sort_order`,
      [projectId]
    );

    return rows;
  }

  /**
   * Поиск всех объектов проекта с комнатами
   */
  static async findProjectWithObjects(projectId: string): Promise<ObjectWithRooms[]> {
    const objects = await this.findByProjectId(projectId);

    const result = await Promise.all(
      objects.map(async (object) => {
        const rooms = await query<(any & RowDataPacket)[]>(
          `SELECT * FROM rooms WHERE object_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [object.id]
        );
        return { ...object, rooms };
      })
    );

    return result;
  }

  /**
   * Поиск всех объектов пользователя
   */
  static async findByUserId(userId: string): Promise<Object[]> {
    const rows = await query<(Object & RowDataPacket)[]>(
      `SELECT o.* FROM objects o
       JOIN projects p ON o.project_id = p.id
       WHERE o.user_id = ? AND o.deleted_at IS NULL AND p.deleted_at IS NULL
       ORDER BY p.name, o.sort_order`,
      [userId]
    );

    return rows;
  }

  /**
   * Поиск объекта по ID и пользователю (проверка прав доступа)
   */
  static async findByIdAndUserId(id: string, userId: string): Promise<Object | null> {
    const rows = await query<(Object & RowDataPacket)[]>(
      `SELECT o.* FROM objects o
       JOIN projects p ON o.project_id = p.id
       WHERE o.id = ? AND o.user_id = ? AND o.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id, userId]
    );

    return rows[0] || null;
  }

  /**
   * Обновление объекта
   */
  static async update(id: string, data: Partial<Object>): Promise<Object | null> {
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
    if (data.address !== undefined) {
      fields.push('address = ?');
      values.push(data.address);
    }
    if (data.use_ai_pricing !== undefined) {
      fields.push('use_ai_pricing = ?');
      values.push(data.use_ai_pricing);
    }
    if (data.last_ai_price_update !== undefined) {
      fields.push('last_ai_price_update = ?');
      values.push(data.last_ai_price_update);
    }
    if (data.sort_order !== undefined) {
      fields.push('sort_order = ?');
      values.push(data.sort_order);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    await execute(
      `UPDATE objects SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  /**
   * Мягкое удаление объекта
   */
  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE objects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Подсчёт количества объектов в проекте (для проверки лимита)
   */
  static async countByProjectId(projectId: string): Promise<number> {
    const rows = await query<any[]>(
      `SELECT COUNT(*) as count FROM objects 
       WHERE project_id = ? AND deleted_at IS NULL`,
      [projectId]
    );

    return rows[0]?.count || 0;
  }

  /**
   * Проверка лимита объектов для бесплатных пользователей
   * @returns true если лимит превышен
   */
  static async isLimitReached(projectId: string, userId: string): Promise<boolean> {
    const MAX_OBJECTS_FREE = 10;

    // Получаем статус премиума пользователя
    const userRows = await query<any[]>(
      'SELECT is_premium FROM users WHERE id = ?',
      [userId]
    );

    const isPremium = userRows[0]?.is_premium || false;

    // Для премиум лимита нет
    if (isPremium) {
      return false;
    }

    // Проверяем количество объектов
    const count = await this.countByProjectId(projectId);
    return count >= MAX_OBJECTS_FREE;
  }
}
