import { query, execute, getConnection } from '../pool.js';
import type { Work, Material, Tool } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';

export class WorkRepository {
  static async create(roomId: string, data: Partial<Work>): Promise<Work> {
    const id = uuidv4();
    
    // Get max sort_order
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM works WHERE room_id = ?',
      [roomId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO works (id, room_id, name, unit, enabled, work_unit_price, calculation_type, count, manual_qty, use_manual_qty, is_custom, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, roomId, data.name || 'Новая работа', data.unit || 'м²', 
        data.enabled ?? true, data.work_unit_price || 0, 
        data.calculation_type || 'floorArea', data.count || null, 
        data.manual_qty || null, data.use_manual_qty ?? false, 
        data.is_custom ?? true, sortOrder
      ]
    );
    
    const work = await this.findById(id);
    return work!;
  }

  static async findById(id: string): Promise<Work | null> {
    const rows = await query<(Work & RowDataPacket)[]>(
      'SELECT * FROM works WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    return rows[0] || null;
  }

  static async findByRoomId(roomId: string): Promise<Work[]> {
    const rows = await query<(Work & RowDataPacket)[]>(
      'SELECT * FROM works WHERE room_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [roomId]
    );
    
    return rows;
  }

  static async update(id: string, data: Partial<Work>): Promise<Work | null> {
    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.unit !== undefined) {
      fields.push('unit = ?');
      values.push(data.unit);
    }
    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(data.enabled);
    }
    if (data.work_unit_price !== undefined) {
      fields.push('work_unit_price = ?');
      values.push(data.work_unit_price);
    }
    if (data.calculation_type !== undefined) {
      fields.push('calculation_type = ?');
      values.push(data.calculation_type);
    }
    if (data.count !== undefined) {
      fields.push('count = ?');
      values.push(data.count);
    }
    if (data.manual_qty !== undefined) {
      fields.push('manual_qty = ?');
      values.push(data.manual_qty);
    }
    if (data.use_manual_qty !== undefined) {
      fields.push('use_manual_qty = ?');
      values.push(data.use_manual_qty);
    }
    if (data.is_custom !== undefined) {
      fields.push('is_custom = ?');
      values.push(data.is_custom);
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
      `UPDATE works SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE works SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  static async reorder(roomId: string, workIds: string[]): Promise<void> {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      
      for (let i = 0; i < workIds.length; i++) {
        const workId = workIds[i];
        if (workId) {
          await conn.execute(
            'UPDATE works SET sort_order = ? WHERE id = ? AND room_id = ?',
            [i, workId, roomId]
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

// Material Repository
export class MaterialRepository {
  static async create(workId: string, data: Partial<Material>): Promise<Material> {
    const id = uuidv4();
    
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM materials WHERE work_id = ?',
      [workId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO materials (id, work_id, name, quantity, unit, price_per_unit, coverage_per_unit, consumption_rate, layers, pieces_per_unit, waste_percent, package_size, is_perimeter, multiplier, auto_calc_enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, workId, data.name || '', data.quantity || 1, data.unit || 'м²', 
        data.price_per_unit || 0, data.coverage_per_unit || null, 
        data.consumption_rate || null, data.layers || 1, 
        data.pieces_per_unit || null, data.waste_percent || 10, 
        data.package_size || null, data.is_perimeter || false, 
        data.multiplier || 1, data.auto_calc_enabled || false, sortOrder
      ]
    );
    
    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Material | null> {
    const rows = await query<(Material & RowDataPacket)[]>(
      'SELECT * FROM materials WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  }

  static async findByWorkId(workId: string): Promise<Material[]> {
    const rows = await query<(Material & RowDataPacket)[]>(
      'SELECT * FROM materials WHERE work_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [workId]
    );
    return rows;
  }

  static async update(id: string, data: Partial<Material>): Promise<Material | null> {
    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    const allowedFields = ['name', 'quantity', 'unit', 'price_per_unit', 'coverage_per_unit', 
      'consumption_rate', 'layers', 'pieces_per_unit', 'waste_percent', 'package_size', 
      'is_perimeter', 'multiplier', 'auto_calc_enabled', 'version'] as const;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field] as string | number | boolean | null);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await execute(`UPDATE materials SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE materials SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }
}

// Tool Repository
export class ToolRepository {
  static async create(workId: string, data: Partial<Tool>): Promise<Tool> {
    const id = uuidv4();
    
    const maxOrderRows = await query<(RowDataPacket & { max_order: number | null })[]>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM tools WHERE work_id = ?',
      [workId]
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    
    await execute(
      `INSERT INTO tools (id, work_id, name, quantity, price, is_rent, rent_period, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, workId, data.name || '', data.quantity || 1, data.price || 0, data.is_rent || false, data.rent_period || null, sortOrder]
    );
    
    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Tool | null> {
    const rows = await query<(Tool & RowDataPacket)[]>(
      'SELECT * FROM tools WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  }

  static async findByWorkId(workId: string): Promise<Tool[]> {
    const rows = await query<(Tool & RowDataPacket)[]>(
      'SELECT * FROM tools WHERE work_id = ? AND deleted_at IS NULL ORDER BY sort_order',
      [workId]
    );
    return rows;
  }

  static async update(id: string, data: Partial<Tool>): Promise<Tool | null> {
    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    const allowedFields = ['name', 'quantity', 'price', 'is_rent', 'rent_period', 'version'] as const;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field] as string | number | boolean | null);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await execute(`UPDATE tools SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE tools SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }
}