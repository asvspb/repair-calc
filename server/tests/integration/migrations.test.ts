import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import knexLib from 'knex';
import type { Knex } from 'knex';

describe('Database Migrations', () => {
  let db: Knex;

  beforeAll(async () => {
    db = knexLib({
      client: 'better-sqlite3',
      connection: ':memory:',
      useNullAsDefault: true,
      migrations: {
        directory: './src/db/migrations',
        extension: 'ts',
      },
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it.skip('should run all migrations without errors (requires PostgreSQL)', async () => {
    await expect(db.migrate.latest()).resolves.toBeDefined();
  });

  it.skip('should create expected tables after migrations (requires PostgreSQL)', async () => {
    const rows = await db('sqlite_master')
      .select('name')
      .where('type', 'table')
      .whereNot('name', 'knex_migrations')
      .whereNot('name', 'knex_migrations_lock')
      .orderBy('name');

    const tableNames = rows.map((r: { name: string }) => r.name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('rooms');
    expect(tableNames).toContain('openings');
    expect(tableNames).toContain('room_subsections');
    expect(tableNames).toContain('room_segments');
    expect(tableNames).toContain('room_obstacles');
    expect(tableNames).toContain('wall_sections');
    expect(tableNames).toContain('works');
    expect(tableNames).toContain('materials');
    expect(tableNames).toContain('tools');
    expect(tableNames).toContain('ai_requests');
    expect(tableNames).toContain('calculated_totals');
    expect(tableNames).toContain('audit_log');
    expect(tableNames).toContain('deleted_entities');
    expect(tableNames).toContain('objects');
  });
});
