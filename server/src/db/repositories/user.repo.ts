import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { User, UserWithPassword } from '../../types/index.js';

export class UserRepository {
  static async create(email: string, password: string, name?: string): Promise<User> {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db('users')
      .insert({
        id,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name: name || null,
      })
      .returning(['id', 'email', 'name', 'role', 'created_at', 'updated_at']);

    return user as User;
  }

  static async findByEmail(email: string): Promise<UserWithPassword | null> {
    const row = await db('users')
      .where({ email: email.toLowerCase() })
      .whereNull('deleted_at')
      .first();

    return (row as UserWithPassword) || null;
  }

  static async findById(id: string): Promise<User | null> {
    const row = await db('users')
      .select('id', 'email', 'name', 'created_at', 'updated_at')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    return (row as User) || null;
  }

  static async update(id: string, data: { name?: string }): Promise<User | null> {
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    const updated = await db('users').where({ id }).whereNull('deleted_at').update(updateData);

    if (!updated) return null;
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const updated = await db('users')
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date() });

    return updated > 0;
  }

  static async verifyPassword(user: UserWithPassword, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }
}
