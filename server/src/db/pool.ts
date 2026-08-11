import type { Knex } from 'knex';
import db from './db.js';
import { winstonLogger } from '../middleware/logger.js';

// NOTE: `any` index signature matches the legacy RowDataPacket interface.
// Required to avoid cascading type errors in legacy repo code.
export interface RowDataPacket {
  [column: string]: any;
}
export type ResultSetHeader = { affectedRows: number };

export { db as pool };

type QueryValue = string | number | boolean | Date | null;

export async function query<T = unknown[]>(sql: string, values?: QueryValue[]): Promise<T> {
  const result = await db.raw(sql, values as unknown as (string | number | boolean | null)[]);
  return (result.rows ?? result) as T;
}

export async function execute(sql: string, values: QueryValue[]): Promise<ResultSetHeader> {
  const result = await db.raw(sql, values as unknown as (string | number | boolean | null)[]);
  return { affectedRows: result.rowCount ?? 0 };
}

export async function testConnection(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch (error) {
    winstonLogger.error('Database connection failed', { error });
    return false;
  }
}

export async function closePool(): Promise<void> {
  await db.destroy();
}

// Backward-compatible transaction helpers for legacy repo code

class TransactionConnection {
  trx: Knex.Transaction | null = null;

  async beginTransaction(): Promise<void> {
    this.trx = await db.transaction();
  }

  async execute(sql: string, values: QueryValue[]): Promise<[ResultSetHeader]> {
    const result = await (this.trx ?? db).raw(
      sql,
      values as unknown as (string | number | boolean | null)[],
    );
    return [{ affectedRows: result.rowCount ?? 0 }];
  }

  query<T = unknown[]>(sql: string, values?: QueryValue[]): Promise<[T]> {
    const conn = this.trx ?? db;
    return conn
      .raw(sql, values as unknown as (string | number | boolean | null)[])
      .then(result => [result.rows ?? []] as unknown as [T]);
  }

  async commit(): Promise<void> {
    if (this.trx && !this.trx.isCompleted()) {
      await this.trx.commit();
    }
  }

  async rollback(): Promise<void> {
    if (this.trx && !this.trx.isCompleted()) {
      await this.trx.rollback();
    }
  }

  async release(): Promise<void> {
    this.trx = null;
  }
}

export async function getConnection(): Promise<TransactionConnection> {
  return new TransactionConnection();
}

export async function transaction<T>(
  callback: (conn: TransactionConnection) => Promise<T>,
): Promise<T> {
  return db.transaction(async trx => {
    const conn = new TransactionConnection();
    conn.trx = trx;
    return callback(conn);
  });
}
