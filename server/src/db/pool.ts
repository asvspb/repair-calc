import mysql, { type RowDataPacket, type ResultSetHeader, type PoolConnection } from 'mysql2/promise';
import { config } from '../config/env.js';

// Create pool with proper typing
export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: config.database.poolLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
});

// Type for query values
type QueryValue = string | number | boolean | Date | null;

// Typed execute wrappers
export async function query<T extends RowDataPacket[]>(
  sql: string, 
  values?: QueryValue[]
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, values);
  return rows;
}

export async function execute(
  sql: string, 
  values: QueryValue[]
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, values);
  return result;
}

export async function getConnection(): Promise<PoolConnection> {
  return pool.getConnection();
}

export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

// Transaction helpers
export async function transaction<T>(
  callback: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}