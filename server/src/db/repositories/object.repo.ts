import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { DbObject, ObjectWithRooms } from '../../types/index.js';

export class ObjectRepository {
  static async create(
    projectId: string,
    userId: string,
    data: {
      name: string;
      city?: string | null;
      address?: string | null;
      use_ai_pricing?: boolean;
    },
  ): Promise<DbObject> {
    const id = uuidv4();

    await db('objects').insert({
      id,
      project_id: projectId,
      user_id: userId,
      name: data.name,
      city: data.city || null,
      address: data.address || null,
      use_ai_pricing: data.use_ai_pricing || false,
      version: 1,
      sort_order: 0,
    });

    return (await this.findById(id))!;
  }

  static async findById(id: string): Promise<DbObject | null> {
    const row = await db('objects').where({ id }).whereNull('deleted_at').first();

    return (row as DbObject) || null;
  }

  static async findByIdWithRooms(id: string): Promise<ObjectWithRooms | null> {
    const object = await this.findById(id);
    if (!object) return null;

    const rooms = await db('rooms')
      .where({ object_id: id })
      .whereNull('deleted_at')
      .orderBy('sort_order');

    return { ...object, rooms };
  }

  static async findByProjectId(projectId: string): Promise<DbObject[]> {
    const rows = await db('objects')
      .where({ project_id: projectId })
      .whereNull('deleted_at')
      .orderBy('sort_order');

    return rows as DbObject[];
  }

  static async findProjectWithObjects(projectId: string): Promise<ObjectWithRooms[]> {
    const objects = await this.findByProjectId(projectId);

    const result = await Promise.all(
      objects.map(async object => {
        const rooms = await db('rooms')
          .where({ object_id: object.id })
          .whereNull('deleted_at')
          .orderBy('sort_order');

        return { ...object, rooms };
      }),
    );

    return result;
  }

  static async findByUserId(userId: string): Promise<DbObject[]> {
    const rows = await db('objects as o')
      .join('projects as p', 'o.project_id', 'p.id')
      .where('o.user_id', userId)
      .whereNull('o.deleted_at')
      .whereNull('p.deleted_at')
      .select('o.*')
      .orderBy(['p.name', 'o.sort_order']);

    return rows as DbObject[];
  }

  static async findByIdAndUserId(id: string, userId: string): Promise<DbObject | null> {
    const row = await db('objects as o')
      .join('projects as p', 'o.project_id', 'p.id')
      .where('o.id', id)
      .where('o.user_id', userId)
      .whereNull('o.deleted_at')
      .whereNull('p.deleted_at')
      .select('o.*')
      .first();

    return (row as DbObject) || null;
  }

  static async update(id: string, data: Partial<DbObject>): Promise<DbObject | null> {
    const fields = [
      'name',
      'city',
      'address',
      'use_ai_pricing',
      'last_ai_price_update',
      'sort_order',
    ] as const;

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 1) {
      return this.findById(id);
    }

    const updated = await db('objects').where({ id }).update(updateData);
    if (!updated) return null;
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const updated = await db('objects')
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date() });

    return updated > 0;
  }

  static async countByProjectId(projectId: string): Promise<number> {
    const row = await db('objects')
      .where({ project_id: projectId })
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    return Number(row?.count ?? 0);
  }

  static async isLimitReached(projectId: string, userId: string): Promise<boolean> {
    const MAX_OBJECTS_FREE = 10;

    const userRow = await db('users').select('is_premium').where({ id: userId }).first();

    const isPremium = (userRow as any)?.is_premium || false;

    if (isPremium) return false;

    const count = await this.countByProjectId(projectId);
    return count >= MAX_OBJECTS_FREE;
  }
}
