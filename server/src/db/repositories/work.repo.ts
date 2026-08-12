import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { Work, Material, Tool } from '../../types/index.js';

export class WorkRepository {
  static async create(roomId: string, data: Partial<Work>): Promise<Work> {
    const id = uuidv4();

    const maxOrderRow = await db('works')
      .where({ room_id: roomId })
      .max('sort_order as max_order')
      .first();
    const sortOrder = ((maxOrderRow?.max_order as number) ?? -1) + 1;

    await db('works').insert({
      id,
      room_id: roomId,
      name: data.name || 'Новая работа',
      unit: data.unit || 'м²',
      enabled: data.enabled ?? true,
      work_unit_price: data.work_unit_price || 0,
      calculation_type: data.calculation_type || 'floorArea',
      count: data.count || null,
      manual_qty: data.manual_qty || null,
      use_manual_qty: data.use_manual_qty ?? false,
      is_custom: data.is_custom ?? true,
      sort_order: sortOrder,
    });

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Work | null> {
    const row = await db('works').where({ id }).whereNull('deleted_at').first();

    return (row as Work) || null;
  }

  static async findByRoomId(roomId: string): Promise<Work[]> {
    const rows = await db('works')
      .where({ room_id: roomId })
      .whereNull('deleted_at')
      .orderBy('sort_order');

    return rows as Work[];
  }

  static async update(id: string, data: Partial<Work>): Promise<Work | null> {
    const fields = [
      'name',
      'unit',
      'enabled',
      'work_unit_price',
      'calculation_type',
      'count',
      'manual_qty',
      'use_manual_qty',
      'is_custom',
      'version',
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    const updated = await db('works').where({ id }).update(updateData);

    if (!updated) return null;
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const updated = await db('works')
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date() });

    return updated > 0;
  }

  static async reorder(roomId: string, workIds: string[]): Promise<void> {
    await db.transaction(async trx => {
      for (let i = 0; i < workIds.length; i++) {
        const workId = workIds[i];
        if (workId) {
          await trx('works').where({ id: workId, room_id: roomId }).update({ sort_order: i });
        }
      }
    });
  }
}

export class MaterialRepository {
  static async create(workId: string, data: Partial<Material>): Promise<Material> {
    const id = uuidv4();

    const maxOrderRow = await db('materials')
      .where({ work_id: workId })
      .max('sort_order as max_order')
      .first();
    const sortOrder = ((maxOrderRow?.max_order as number) ?? -1) + 1;

    await db('materials').insert({
      id,
      work_id: workId,
      name: data.name || '',
      quantity: data.quantity || 1,
      unit: data.unit || 'м²',
      price_per_unit: data.price_per_unit || 0,
      coverage_per_unit: data.coverage_per_unit || null,
      consumption_rate: data.consumption_rate || null,
      layers: data.layers || 1,
      pieces_per_unit: data.pieces_per_unit || null,
      waste_percent: data.waste_percent || 10,
      package_size: data.package_size || null,
      is_perimeter: data.is_perimeter || false,
      multiplier: data.multiplier || 1,
      auto_calc_enabled: data.auto_calc_enabled || false,
      sort_order: sortOrder,
    });

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Material | null> {
    const row = await db('materials').where({ id }).whereNull('deleted_at').first();

    return (row as Material) || null;
  }

  static async findByWorkId(workId: string): Promise<Material[]> {
    const rows = await db('materials')
      .where({ work_id: workId })
      .whereNull('deleted_at')
      .orderBy('sort_order');

    return rows as Material[];
  }

  static async update(id: string, data: Partial<Material>): Promise<Material | null> {
    const allowedFields = [
      'name',
      'quantity',
      'unit',
      'price_per_unit',
      'coverage_per_unit',
      'consumption_rate',
      'layers',
      'pieces_per_unit',
      'waste_percent',
      'package_size',
      'is_perimeter',
      'multiplier',
      'auto_calc_enabled',
      'version',
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) return this.findById(id);

    await db('materials').where({ id }).update(updateData);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const updated = await db('materials')
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date() });

    return updated > 0;
  }
}

export class ToolRepository {
  static async create(workId: string, data: Partial<Tool>): Promise<Tool> {
    const id = uuidv4();

    const maxOrderRow = await db('tools')
      .where({ work_id: workId })
      .max('sort_order as max_order')
      .first();
    const sortOrder = ((maxOrderRow?.max_order as number) ?? -1) + 1;

    await db('tools').insert({
      id,
      work_id: workId,
      name: data.name || '',
      quantity: data.quantity || 1,
      price: data.price || 0,
      is_rent: data.is_rent || false,
      rent_period: data.rent_period || null,
      sort_order: sortOrder,
    });

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<Tool | null> {
    const row = await db('tools').where({ id }).whereNull('deleted_at').first();

    return (row as Tool) || null;
  }

  static async findByWorkId(workId: string): Promise<Tool[]> {
    const rows = await db('tools')
      .where({ work_id: workId })
      .whereNull('deleted_at')
      .orderBy('sort_order');

    return rows as Tool[];
  }

  static async update(id: string, data: Partial<Tool>): Promise<Tool | null> {
    const allowedFields = [
      'name',
      'quantity',
      'price',
      'is_rent',
      'rent_period',
      'version',
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) return this.findById(id);

    await db('tools').where({ id }).update(updateData);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const updated = await db('tools')
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date() });

    return updated > 0;
  }
}
