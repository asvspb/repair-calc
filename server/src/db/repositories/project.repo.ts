import { query, execute } from '../pool.js';
import type { Project, Room } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';

export class ProjectRepository {
  static async create(userId: string, data: { name: string; city?: string; use_ai_pricing?: boolean }): Promise<Project> {
    const id = uuidv4();
    
    await execute(
      `INSERT INTO projects (id, user_id, name, city, use_ai_pricing) VALUES (?, ?, ?, ?, ?)`,
      [id, userId, data.name, data.city || null, data.use_ai_pricing || false]
    );
    
    const project = await this.findById(id);
    return project!;
  }

  static async findById(id: string): Promise<Project | null> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    
    return rows[0] || null;
  }

  static async findByUserId(userId: string): Promise<Project[]> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
      [userId]
    );
    
    return rows;
  }

  static async findByIdAndUserId(id: string, userId: string): Promise<Project | null> {
    const rows = await query<(Project & RowDataPacket)[]>(
      `SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId]
    );
    
    return rows[0] || null;
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
      values
    );
    
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  // Full project with rooms (for sync)
  static async findFullProject(id: string, userId: string): Promise<(Project & { rooms: Room[] }) | null> {
    const project = await this.findByIdAndUserId(id, userId);
    if (!project) return null;

    const rooms = await query<(Room & RowDataPacket)[]>(
      `SELECT * FROM rooms WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
      [id]
    );

    return { ...project, rooms };
  }

  // Get all projects with rooms for sync
  static async findAllByUserIdForSync(userId: string): Promise<(Project & { rooms: Room[] })[]> {
    const projects = await this.findByUserId(userId);
    
    const result = await Promise.all(
      projects.map(async (project) => {
        const rooms = await query<(Room & RowDataPacket)[]>(
          `SELECT * FROM rooms WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [project.id]
        );
        return { ...project, rooms };
      })
    );

    return result;
  }
}