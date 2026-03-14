import type { Knex } from 'knex';

/**
 * Миграция для A/B тестирования парсеров
 * Позволяет сравнивать производительность разных парсеров
 */
export async function up(knex: Knex): Promise<void> {
  // ═══════════════════════════════════════════════════════
  // КОНФИГУРАЦИЯ A/B ТЕСТОВ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('ab_tests', (table) => {
    table.string('id', 36).primary();
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    
    // Парсеры для сравнения
    table.enum('parser_a', ['ai_gemini', 'ai_mistral', 'web_scraper', 'api']).notNullable();
    table.enum('parser_b', ['ai_gemini', 'ai_mistral', 'web_scraper', 'api']).notNullable();
    
    // Распределение трафика (процент для parser_a, остальное - parser_b)
    table.integer('traffic_split').defaultTo(50); // 50/50
    
    // Статус теста
    table.enum('status', ['draft', 'running', 'paused', 'completed', 'cancelled']).defaultTo('draft');
    
    // Временные рамки
    table.timestamp('started_at').nullable();
    table.timestamp('ended_at').nullable();
    
    // Результаты (кэшированные)
    table.integer('total_requests_a').defaultTo(0);
    table.integer('total_requests_b').defaultTo(0);
    table.integer('success_count_a').defaultTo(0);
    table.integer('success_count_b').defaultTo(0);
    table.integer('avg_response_time_a').defaultTo(0); // в ms
    table.integer('avg_response_time_b').defaultTo(0);
    table.decimal('avg_price_a', 12, 2).nullable();
    table.decimal('avg_price_b', 12, 2).nullable();
    
    // Решение
    table.enum('winner', ['parser_a', 'parser_b', 'tie']).nullable();
    table.decimal('confidence_level', 4, 3).nullable(); // 0-1
    
    // Кто создал и закончил
    table.string('created_by', 36).nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('completed_by', 36).nullable().references('id').inTable('users').onDelete('SET NULL');
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Индексы
    table.index(['status'], 'idx_status');
    table.index(['parser_a', 'parser_b'], 'idx_parsers');
    table.index(['started_at', 'ended_at'], 'idx_timeframe');
  });

  // ═══════════════════════════════════════════════════════
  // РЕЗУЛЬТАТЫ A/B ТЕСТОВ (детальные)
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('ab_test_results', (table) => {
    table.string('id', 36).primary();
    table.string('test_id', 36).notNullable().references('id').inTable('ab_tests').onDelete('CASCADE');
    
    // Запрос
    table.string('item_name', 255).notNullable();
    table.string('city', 100).notNullable();
    table.string('category', 50).notNullable();
    
    // Какой парсер использовался (A или B)
    table.enum('parser_group', ['a', 'b']).notNullable();
    table.enum('parser_type', ['ai_gemini', 'ai_mistral', 'web_scraper', 'api']).notNullable();
    
    // Результат
    table.boolean('success').defaultTo(false);
    table.decimal('price_min', 12, 2).nullable();
    table.decimal('price_avg', 12, 2).nullable();
    table.decimal('price_max', 12, 2).nullable();
    table.string('currency', 3).defaultTo('RUB');
    table.decimal('confidence_score', 3, 2).nullable();
    
    // Метрики
    table.integer('response_time_ms').nullable();
    table.text('error_message').nullable();
    
    // Метаданные
    table.json('metadata').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Индексы
    table.index(['test_id'], 'idx_test');
    table.index(['parser_group'], 'idx_group');
    table.index(['success'], 'idx_success');
    table.index(['created_at'], 'idx_created');
  });

  // ═══════════════════════════════════════════════════════
  // СТАТИСТИКА A/B ТЕСТОВ (агрегированная по дням)
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('ab_test_daily_stats', (table) => {
    table.string('id', 36).primary();
    table.string('test_id', 36).notNullable().references('id').inTable('ab_tests').onDelete('CASCADE');
    table.date('date').notNullable();
    
    // Группа A
    table.integer('requests_a').defaultTo(0);
    table.integer('success_a').defaultTo(0);
    table.integer('failures_a').defaultTo(0);
    table.integer('total_response_time_a').defaultTo(0);
    table.decimal('total_price_a', 15, 2).defaultTo(0);
    
    // Группа B
    table.integer('requests_b').defaultTo(0);
    table.integer('success_b').defaultTo(0);
    table.integer('failures_b').defaultTo(0);
    table.integer('total_response_time_b').defaultTo(0);
    table.decimal('total_price_b', 15, 2).defaultTo(0);
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Уникальность по тесту и дате
    table.unique(['test_id', 'date'], 'uniq_test_date');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ab_test_daily_stats');
  await knex.schema.dropTableIfExists('ab_test_results');
  await knex.schema.dropTableIfExists('ab_tests');
}