/**
 * Repository for update_webhooks table
 */

import { query, execute } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export type WebhookEvent = 
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'job.anomaly_detected'
  | 'parser.circuit_open'
  | 'parser.circuit_closed';

export interface UpdateWebhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  retry_count: number;
  retry_delay_ms: number;
  timeout_ms: number;
  total_sent: number;
  total_failed: number;
  last_triggered_at: Date | null;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateWebhookInput {
  url: string;
  events: WebhookEvent[];
  secret: string;
  active?: boolean;
  retry_count?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
}

export interface UpdateWebhookInput {
  url?: string;
  events?: WebhookEvent[];
  secret?: string;
  active?: boolean;
  retry_count?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
}

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ
// ═══════════════════════════════════════════════════════

export class WebhookRepository {
  static async create(input: CreateWebhookInput): Promise<UpdateWebhook> {
    const id = uuidv4();
    
    await execute(
      `INSERT INTO update_webhooks (
        id, url, events, secret, active,
        retry_count, retry_delay_ms, timeout_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.url,
        JSON.stringify(input.events),
        input.secret,
        input.active ?? true,
        input.retry_count ?? 3,
        input.retry_delay_ms ?? 5000,
        input.timeout_ms ?? 5000,
      ]
    );
    
    const rows = await query<(UpdateWebhook & RowDataPacket)[]>(
      'SELECT * FROM update_webhooks WHERE id = ?',
      [id]
    );
    
    return this.parseRow(rows[0]!);
  }

  static async findById(id: string): Promise<UpdateWebhook | null> {
    const rows = await query<(UpdateWebhook & RowDataPacket)[]>(
      'SELECT * FROM update_webhooks WHERE id = ?',
      [id]
    );
    
    return rows[0] ? this.parseRow(rows[0]) : null;
  }

  static async findAll(): Promise<UpdateWebhook[]> {
    const rows = await query<(UpdateWebhook & RowDataPacket)[]>(
      'SELECT * FROM update_webhooks ORDER BY created_at DESC'
    );
    
    return rows.map(row => this.parseRow(row));
  }

  static async findActive(): Promise<UpdateWebhook[]> {
    const rows = await query<(UpdateWebhook & RowDataPacket)[]>(
      'SELECT * FROM update_webhooks WHERE active = TRUE ORDER BY created_at DESC'
    );
    
    return rows.map(row => this.parseRow(row));
  }

  static async findByEvent(event: WebhookEvent): Promise<UpdateWebhook[]> {
    const rows = await query<(UpdateWebhook & RowDataPacket)[]>(
      `SELECT * FROM update_webhooks 
       WHERE active = TRUE AND JSON_CONTAINS(events, ?)`,
      [JSON.stringify(event)]
    );
    
    return rows.map(row => this.parseRow(row));
  }

  static async update(id: string, input: UpdateWebhookInput): Promise<UpdateWebhook | null> {
    const fields: string[] = [];
    const values: (string | number | boolean)[] = [];

    if (input.url !== undefined) {
      fields.push('url = ?');
      values.push(input.url);
    }
    if (input.events !== undefined) {
      fields.push('events = ?');
      values.push(JSON.stringify(input.events));
    }
    if (input.secret !== undefined) {
      fields.push('secret = ?');
      values.push(input.secret);
    }
    if (input.active !== undefined) {
      fields.push('active = ?');
      values.push(input.active);
    }
    if (input.retry_count !== undefined) {
      fields.push('retry_count = ?');
      values.push(input.retry_count);
    }
    if (input.retry_delay_ms !== undefined) {
      fields.push('retry_delay_ms = ?');
      values.push(input.retry_delay_ms);
    }
    if (input.timeout_ms !== undefined) {
      fields.push('timeout_ms = ?');
      values.push(input.timeout_ms);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    await execute(
      `UPDATE update_webhooks SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await execute(
      'DELETE FROM update_webhooks WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  static async recordSuccess(id: string): Promise<void> {
    await execute(
      `UPDATE update_webhooks 
       SET total_sent = total_sent + 1,
           last_triggered_at = CURRENT_TIMESTAMP,
           last_success_at = CURRENT_TIMESTAMP,
           last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  }

  static async recordFailure(id: string, error: string): Promise<void> {
    await execute(
      `UPDATE update_webhooks 
       SET total_sent = total_sent + 1,
           total_failed = total_failed + 1,
           last_triggered_at = CURRENT_TIMESTAMP,
           last_failure_at = CURRENT_TIMESTAMP,
           last_error = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [error, id]
    );
  }

  private static parseRow(row: UpdateWebhook): UpdateWebhook {
    return {
      ...row,
      events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
    };
  }
}