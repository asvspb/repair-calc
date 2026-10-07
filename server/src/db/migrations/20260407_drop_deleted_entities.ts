import type { Knex } from 'knex';

/**
 * Миграция 20260407_drop_deleted_entities (TASK-BATCH-043, решение №1
 * трассировки ТЗ v1.1): таблица `deleted_entities` удаляется как
 * нереализованная идея ТЗ v1.1 — записей в неё не пишет и не читает никто
 * (grep по server/src: только миграция 20260331). Финальная схема удаления —
 * soft-delete (`deleted_at`) + retention-джоба `cleanupDeleted.ts` (90 дней,
 * cron 03:00).
 *
 * BREAKING-INTENT не требуется: таблица никогда не заполнялась; в проде могут
 * лежать разве что мусорные строки, которые никто не читал (drop безопасен).
 * FK из других таблиц на deleted_entities нет (проверено grep'ом миграций).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('deleted_entities');
}

export async function down(knex: Knex): Promise<void> {
  // Воссоздание по определению из 20260331_add_objects.ts (для отката)
  const hasDeletedEntities = await knex.schema.hasTable('deleted_entities');
  if (!hasDeletedEntities) {
    await knex.schema.createTable('deleted_entities', table => {
      table.string('id', 36).primary();
      table
        .string('user_id', 36)
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table
        .enum('entity_type', ['project', 'object', 'room', 'work', 'material', 'tool'])
        .notNullable();
      table.string('entity_id', 36).notNullable();
      table.json('snapshot').nullable();
      table.timestamp('deleted_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable();

      table.index(['user_id', 'deleted_at']);
      table.index(['expires_at']);
    });
  }
}
