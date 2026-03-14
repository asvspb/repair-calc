/**
 * Migration: update_webhooks table
 * Для хранения настроек вебхуков уведомлений
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('update_webhooks', (table) => {
    table.string('id', 36).primary();
    
    table.string('url', 500).notNullable();
    table.json('events').notNullable(); // ['job.completed', 'job.failed', ...]
    table.string('secret', 255).notNullable(); // Для HMAC-подписи
    table.boolean('active').defaultTo(true);
    
    // Retry settings
    table.integer('retry_count').defaultTo(3);
    table.integer('retry_delay_ms').defaultTo(5000);
    table.integer('timeout_ms').defaultTo(5000);
    
    // Statistics
    table.integer('total_sent').defaultTo(0);
    table.integer('total_failed').defaultTo(0);
    table.timestamp('last_triggered_at').nullable();
    table.timestamp('last_success_at').nullable();
    table.timestamp('last_failure_at').nullable();
    table.text('last_error').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['active'], 'idx_webhooks_active');
    table.index(['last_triggered_at'], 'idx_webhooks_last_triggered');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('update_webhooks');
}