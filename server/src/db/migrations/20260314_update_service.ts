import type { Knex } from 'knex';

/**
 * Миграция для Update Service
 * Создаёт таблицы для службы обновления цен из различных источников
 * 
 * @see docs/UPDATE_SERVICE_SPEC.md
 */
export async function up(knex: Knex): Promise<void> {
  // ═══════════════════════════════════════════════════════
  // ИСТОЧНИКИ ЦЕН
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('price_sources', (table) => {
    table.string('id', 36).primary();
    table.string('name', 255).notNullable();
    table.enum('type', ['ai_gemini', 'ai_mistral', 'web_scraper', 'api', 'manual']).notNullable();
    table.string('api_endpoint', 255).nullable();
    table.boolean('is_active').defaultTo(true);
    table.integer('priority').defaultTo(1);
    table.integer('rate_limit_per_minute').defaultTo(60);
    
    // Circuit Breaker state
    table.integer('circuit_breaker_failures').defaultTo(0);
    table.enum('circuit_breaker_state', ['closed', 'open', 'half-open']).defaultTo('closed');
    table.timestamp('circuit_breaker_last_failure_at').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['type', 'is_active'], 'idx_type_active');
    table.index(['priority'], 'idx_priority');
  });

  // ═══════════════════════════════════════════════════════
  // КАТАЛОГ ЦЕН
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('price_catalog', (table) => {
    table.string('id', 36).primary();
    table.string('name', 255).notNullable();
    table.enum('category', ['work', 'material', 'tool']).notNullable();
    table.string('unit', 36).defaultTo('м²');
    table.string('city', 100).notNullable();
    
    // Цены
    table.decimal('price_min', 12, 2).defaultTo(0);
    table.decimal('price_avg', 12, 2).defaultTo(0);
    table.decimal('price_max', 12, 2).defaultTo(0);
    table.string('currency', 3).defaultTo('RUB');
    
    // Источник
    table.string('source_id', 36).nullable().references('id').inTable('price_sources').onDelete('SET NULL');
    table.string('source_type', 50).nullable();
    
    // Метаданные
    table.decimal('confidence_score', 3, 2).defaultTo(0.50);
    table.text('description').nullable();
    table.json('metadata').nullable();
    
    // Валидность
    table.timestamp('valid_from').defaultTo(knex.fn.now());
    table.timestamp('valid_until').nullable();
    
    table.integer('version').defaultTo(1);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Уникальность и индексы
    table.unique(['name', 'city', 'category', 'source_type'], 'uniq_price');
    table.index(['name', 'city', 'category'], 'idx_name_city_category');
    table.index(['city', 'category'], 'idx_city_category');
    table.index(['valid_until'], 'idx_valid_until');
    table.index(['source_id', 'updated_at'], 'idx_source');
    table.index(['updated_at'], 'idx_updated');
  });

  // ═══════════════════════════════════════════════════════
  // ИСТОРИЯ ИЗМЕНЕНИЙ ЦЕН
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('price_history', (table) => {
    table.string('id', 36).primary();
    table.string('price_catalog_id', 36).notNullable().references('id').inTable('price_catalog').onDelete('CASCADE');
    table.string('job_id', 36).nullable();
    
    // Старые и новые значения
    table.decimal('old_price_min', 12, 2).nullable();
    table.decimal('old_price_avg', 12, 2).nullable();
    table.decimal('old_price_max', 12, 2).nullable();
    table.decimal('new_price_min', 12, 2).nullable();
    table.decimal('new_price_avg', 12, 2).nullable();
    table.decimal('new_price_max', 12, 2).nullable();
    table.decimal('price_change_percent', 6, 2).nullable();
    
    // Контекст
    table.string('source_id', 36).nullable();
    table.decimal('confidence_score', 3, 2).nullable();
    table.boolean('requires_review').defaultTo(false);
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['price_catalog_id'], 'idx_catalog');
    table.index(['job_id'], 'idx_job');
    table.index(['created_at'], 'idx_created');
  });

  // ═══════════════════════════════════════════════════════
  // ЗАДАЧИ ОБНОВЛЕНИЯ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('update_jobs', (table) => {
    table.string('id', 36).primary();
    table.enum('type', ['scheduled', 'manual', 'incremental']).notNullable();
    table.enum('status', ['pending', 'running', 'completed', 'failed', 'cancelled']).defaultTo('pending');
    
    // Параметры
    table.string('city', 100).nullable();
    table.json('categories').nullable();
    table.json('sources').nullable();
    table.string('triggered_by', 36).nullable().references('id').inTable('users').onDelete('SET NULL');
    
    // Прогресс
    table.integer('total_items').defaultTo(0);
    table.integer('processed_items').defaultTo(0);
    table.integer('failed_items').defaultTo(0);
    
    // Результаты
    table.integer('items_created').defaultTo(0);
    table.integer('items_updated').defaultTo(0);
    table.integer('items_skipped').defaultTo(0);
    
    // Время
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.integer('duration_ms').nullable();
    
    // Ошибки
    table.text('error_message').nullable();
    table.json('error_details').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['status'], 'idx_status');
    table.index(['created_at'], 'idx_created');
    table.index(['type', 'status'], 'idx_type_status');
  });

  // ═══════════════════════════════════════════════════════
  // ДЕТАЛИЗАЦИЯ ЗАДАЧ ПО ЭЛЕМЕНТАМ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('update_job_items', (table) => {
    table.string('id', 36).primary();
    table.string('job_id', 36).notNullable().references('id').inTable('update_jobs').onDelete('CASCADE');
    table.string('item_name', 255).notNullable();
    table.string('item_category', 50).notNullable();
    table.string('city', 100).notNullable();
    
    table.enum('status', ['pending', 'success', 'failed', 'skipped']).defaultTo('pending');
    table.string('source', 50).nullable();
    
    table.string('price_catalog_id', 36).nullable().references('id').inTable('price_catalog').onDelete('SET NULL');
    table.decimal('price_change', 12, 2).nullable();
    
    table.text('error_message').nullable();
    
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.integer('duration_ms').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['job_id'], 'idx_job');
    table.index(['status'], 'idx_status');
    table.index(['price_catalog_id'], 'idx_catalog');
  });

  // ═══════════════════════════════════════════════════════
  // ПАРАМЕТРЫ ЗАДАЧ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('update_job_params', (table) => {
    table.string('id', 36).primary();
    table.string('job_id', 36).notNullable().references('id').inTable('update_jobs').onDelete('CASCADE');
    
    table.string('param_name', 100).notNullable();
    table.json('param_value').notNullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.unique(['job_id', 'param_name'], 'uniq_job_param');
  });

  // ═══════════════════════════════════════════════════════
  // БЛОКИРОВКИ ЗАДАЧ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('update_job_locks', (table) => {
    table.string('id', 36).primary();
    table.string('job_id', 36).notNullable().references('id').inTable('update_jobs').onDelete('CASCADE');
    table.string('item_key', 255).notNullable();
    table.timestamp('locked_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable();
    
    table.unique(['item_key'], 'uniq_item_key');
    table.index(['job_id'], 'idx_job');
    table.index(['expires_at'], 'idx_expires');
  });

  // ═══════════════════════════════════════════════════════
  // ВЕБХУКИ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('update_webhooks', (table) => {
    table.string('id', 36).primary();
    table.string('url', 500).notNullable();
    table.json('events').notNullable();
    table.string('secret', 255).nullable();
    table.boolean('active').defaultTo(true);
    table.integer('retry_count').defaultTo(3);
    table.integer('retry_delay_ms').defaultTo(5000);
    table.timestamp('last_triggered_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // ═══════════════════════════════════════════════════════
  // НАСТРОЙКИ ПЛАНИРОВЩИКА
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('scheduler_config', (table) => {
    table.string('id', 36).primary();
    table.boolean('enabled').defaultTo(true);
    table.string('cron', 100).defaultTo('0 3 * * *');
    table.string('timezone', 50).defaultTo('Europe/Moscow');
    table.timestamp('last_run_at').nullable();
    table.string('last_run_status', 20).nullable();
    table.timestamp('next_run_at').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // ═══════════════════════════════════════════════════════
  // ЛОГИ ОБНОВЛЕНИЙ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('update_logs', (table) => {
    table.string('id', 36).primary();
    table.string('job_id', 36).nullable().references('id').inTable('update_jobs').onDelete('SET NULL');
    table.enum('level', ['info', 'debug', 'warn', 'error']).notNullable();
    table.text('message').notNullable();
    table.json('context').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['job_id'], 'idx_job');
    table.index(['level', 'created_at'], 'idx_level_created');
  });

  // ═══════════════════════════════════════════════════════
  // СЕED ДАННЫЕ
  // ═══════════════════════════════════════════════════════
  
  // Добавляем источники цен по умолчанию
  await knex('price_sources').insert([
    {
      id: 'source-gemini-001',
      name: 'Google Gemini',
      type: 'ai_gemini',
      is_active: true,
      priority: 1,
      rate_limit_per_minute: 60,
    },
    {
      id: 'source-mistral-001',
      name: 'Mistral AI',
      type: 'ai_mistral',
      is_active: true,
      priority: 2,
      rate_limit_per_minute: 100,
    },
    {
      id: 'source-lemana-001',
      name: 'Lemana PRO',
      type: 'web_scraper',
      api_endpoint: 'https://volgograd.lemanapro.ru',
      is_active: true,
      priority: 3,
      rate_limit_per_minute: 30,
    },
    {
      id: 'source-bazavit-001',
      name: 'Bazavit',
      type: 'web_scraper',
      api_endpoint: 'https://bazavit.ru',
      is_active: true,
      priority: 4,
      rate_limit_per_minute: 30,
    },
    {
      id: 'source-manual-001',
      name: 'Ручной ввод',
      type: 'manual',
      is_active: true,
      priority: 0, // Высший приоритет
    },
  ]);

  // Добавляем конфигурацию планировщика по умолчанию
  await knex('scheduler_config').insert({
    id: 'scheduler-main-001',
    enabled: true,
    cron: '0 3 * * *',
    timezone: 'Europe/Moscow',
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('update_logs');
  await knex.schema.dropTableIfExists('scheduler_config');
  await knex.schema.dropTableIfExists('update_webhooks');
  await knex.schema.dropTableIfExists('update_job_locks');
  await knex.schema.dropTableIfExists('update_job_params');
  await knex.schema.dropTableIfExists('update_job_items');
  await knex.schema.dropTableIfExists('update_jobs');
  await knex.schema.dropTableIfExists('price_history');
  await knex.schema.dropTableIfExists('price_catalog');
  await knex.schema.dropTableIfExists('price_sources');
}