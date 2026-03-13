import { query, execute } from '../pool.js';
import type { User, UserWithPassword } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';

export class UserRepository {
  static async create(email: string, password: string, name?: string): Promise<User> {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    
    await execute(
      `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`,
      [id, email.toLowerCase(), passwordHash, name || null]
    );
    
    const rows = await query<(User & RowDataPacket)[]>(
      'SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    
    return rows[0]!;
  }

  static async findByEmail(email: string): Promise<UserWithPassword | null> {
    const rows = await query<(UserWithPassword & RowDataPacket)[]>(
      'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
      [email.toLowerCase()]
    );
    
    return rows[0] || null;
  }

  static async findById(id: string): Promise<User | null> {
    const rows = await query<(User & RowDataPacket)[]>(
      'SELECT id, email, name, created_at, updated_at FROM users WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    return rows[0] || null;
  }

  static async update(id: string, data: { name?: string }): Promise<User | null> {
    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    
    await execute(
      `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  static async verifyPassword(user: UserWithPassword, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }
}