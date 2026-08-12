import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ═══════════════════════════════════════════════════════
  // СПРАВОЧНИКИ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('units', table => {
    table.string('id', 36).primary();
    table.string('code', 10).notNullable().unique();
    table.string('name', 100).notNullable();
  });

  // ═══════════════════════════════════════════════════════
  // ПОЛЬЗОВАТЕЛИ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('users', table => {
    table.string('id', 36).primary();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('name', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['email']);
    table.index(['deleted_at'], 'users_deleted_at_idx');
  });

  // ═══════════════════════════════════════════════════════
  // ПРОЕКТЫ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('projects', table => {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('city', 100);
    table.boolean('use_ai_pricing').defaultTo(false);
    table.timestamp('last_ai_price_update').nullable();
    table.integer('version').defaultTo(1);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['user_id']);
    table.index(['deleted_at'], 'projects_deleted_at_idx');
  });

  // ═══════════════════════════════════════════════════════
  // КОМНАТЫ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('rooms', table => {
    table.string('id', 36).primary();
    table
      .string('project_id', 36)
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.enum('geometry_mode', ['simple', 'extended', 'advanced']).defaultTo('simple');
    table.decimal('length', 12, 4).defaultTo(0);
    table.decimal('width', 12, 4).defaultTo(0);
    table.decimal('height', 12, 4).defaultTo(0);
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['project_id']);
    table.index(['project_id', 'sort_order']);
    table.index(['deleted_at'], 'rooms_deleted_at_idx');
  });

  // ═══════════════════════════════════════════════════════
  // ПРОЁМЫ (окна/двери)
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('openings', table => {
    table.string('id', 36).primary();
    table.string('room_id', 36).notNullable().references('id').inTable('rooms').onDelete('CASCADE');
    table.string('subsection_id', 36).nullable();
    table.enum('type', ['window', 'door']).notNullable();
    table.decimal('width', 12, 4).notNullable();
    table.decimal('height', 12, 4).notNullable();
    table.string('comment', 500);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['room_id']);
    table.index(['room_id', 'sort_order']);
  });

  // ═══════════════════════════════════════════════════════
  // EXTENDED MODE: секции помещения
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('room_subsections', table => {
    table.string('id', 36).primary();
    table.string('room_id', 36).notNullable().references('id').inTable('rooms').onDelete('CASCADE');
    table.string('name', 255);
    table
      .enum('shape', ['rectangle', 'trapezoid', 'triangle', 'parallelogram'])
      .defaultTo('rectangle');
    // Rectangle
    table.decimal('length', 12, 4).defaultTo(0);
    table.decimal('width', 12, 4).defaultTo(0);
    // Trapezoid
    table.decimal('base1', 12, 4).nullable();
    table.decimal('base2', 12, 4).nullable();
    table.decimal('depth', 12, 4).nullable();
    table.decimal('side1', 12, 4).nullable();
    table.decimal('side2', 12, 4).nullable();
    // Triangle
    table.decimal('side_a', 12, 4).nullable();
    table.decimal('side_b', 12, 4).nullable();
    table.decimal('side_c', 12, 4).nullable();
    // Parallelogram
    table.decimal('base', 12, 4).nullable();
    table.decimal('side', 12, 4).nullable();
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['room_id']);
    table.index(['room_id', 'sort_order']);
  });

  // Add FK for openings -> subsections
  await knex.schema.alterTable('openings', table => {
    table.foreign('subsection_id').references('id').inTable('room_subsections').onDelete('CASCADE');
  });

  // ═══════════════════════════════════════════════════════
  // ADVANCED MODE: сегменты, препятствия, перепады
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('room_segments', table => {
    table.string('id', 36).primary();
    table.string('room_id', 36).notNullable().references('id').inTable('rooms').onDelete('CASCADE');
    table.string('name', 255);
    table.decimal('length', 12, 4).defaultTo(0);
    table.decimal('width', 12, 4).defaultTo(0);
    table.enum('operation', ['add', 'subtract']).defaultTo('subtract');
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['room_id']);
    table.index(['room_id', 'sort_order']);
  });

  await knex.schema.createTable('room_obstacles', table => {
    table.string('id', 36).primary();
    table.string('room_id', 36).notNullable().references('id').inTable('rooms').onDelete('CASCADE');
    table.string('name', 255);
    table.enum('type', ['column', 'duct', 'niche', 'other']).defaultTo('column');
    table.decimal('area', 12, 4).defaultTo(0);
    table.decimal('perimeter', 12, 4).defaultTo(0);
    table.enum('operation', ['add', 'subtract']).defaultTo('subtract');
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['room_id']);
    table.index(['room_id', 'sort_order']);
  });

  await knex.schema.createTable('wall_sections', table => {
    table.string('id', 36).primary();
    table.string('room_id', 36).notNullable().references('id').inTable('rooms').onDelete('CASCADE');
    table.string('name', 255);
    table.decimal('length', 12, 4).defaultTo(0);
    table.decimal('height', 12, 4).defaultTo(0);
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['room_id']);
    table.index(['room_id', 'sort_order']);
  });

  // ═══════════════════════════════════════════════════════
  // РАБОТЫ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('works', table => {
    table.string('id', 36).primary();
    table.string('room_id', 36).notNullable().references('id').inTable('rooms').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('unit', 36).defaultTo('м²');
    table.boolean('enabled').defaultTo(true);
    table.decimal('work_unit_price', 12, 2).defaultTo(0);
    table
      .enum('calculation_type', ['floorArea', 'netWallArea', 'skirtingLength', 'customCount'])
      .defaultTo('floorArea');
    table.integer('count').nullable();
    table.decimal('manual_qty', 10, 3).nullable();
    table.boolean('use_manual_qty').defaultTo(false);
    table.boolean('is_custom').defaultTo(true);
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['room_id']);
    table.index(['room_id', 'sort_order']);
  });

  // ═══════════════════════════════════════════════════════
  // МАТЕРИАЛЫ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('materials', table => {
    table.string('id', 36).primary();
    table.string('work_id', 36).notNullable().references('id').inTable('works').onDelete('CASCADE');
    table.string('name', 255);
    table.decimal('quantity', 10, 3).defaultTo(1);
    table.string('unit', 36).defaultTo('м²');
    table.decimal('price_per_unit', 12, 2).defaultTo(0);
    table.decimal('coverage_per_unit', 10, 3).nullable();
    table.decimal('consumption_rate', 10, 3).nullable();
    table.integer('layers').defaultTo(1);
    table.integer('pieces_per_unit').nullable();
    table.decimal('waste_percent', 5, 2).defaultTo(10);
    table.decimal('package_size', 10, 3).nullable();
    table.boolean('is_perimeter').defaultTo(false);
    table.decimal('multiplier', 10, 3).defaultTo(1);
    table.boolean('auto_calc_enabled').defaultTo(false);
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['work_id']);
    table.index(['work_id', 'sort_order']);
  });

  // ═══════════════════════════════════════════════════════
  // ИНСТРУМЕНТЫ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('tools', table => {
    table.string('id', 36).primary();
    table.string('work_id', 36).notNullable().references('id').inTable('works').onDelete('CASCADE');
    table.string('name', 255);
    table.integer('quantity').defaultTo(1);
    table.decimal('price', 12, 2).defaultTo(0);
    table.boolean('is_rent').defaultTo(false);
    table.integer('rent_period').nullable();
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    table.index(['work_id']);
    table.index(['work_id', 'sort_order']);
  });

  // ═══════════════════════════════════════════════════════
  // AI: история запросов
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('ai_requests', table => {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table
      .string('project_id', 36)
      .nullable()
      .references('id')
      .inTable('projects')
      .onDelete('SET NULL');
    table.enum('provider', ['gemini', 'mistral']).notNullable();
    table.string('request_type', 50).notNullable();
    table.string('prompt_hash', 64);
    table.json('response');
    table.integer('tokens_used').defaultTo(0);
    table.decimal('cost_usd', 10, 6).defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['user_id']);
    table.index(['project_id']);
    table.index(['prompt_hash', 'provider']);
  });

  // ═══════════════════════════════════════════════════════
  // КЭШ ВЫЧИСЛЕНИЙ
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('calculated_totals', table => {
    table
      .string('project_id', 36)
      .primary()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table.decimal('total_area', 12, 2);
    table.decimal('total_works', 12, 2);
    table.decimal('total_materials', 12, 2);
    table.decimal('total_tools', 12, 2);
    table.decimal('grand_total', 12, 2);
    table.timestamp('calculated_at').defaultTo(knex.fn.now());
  });

  // ═══════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════
  await knex.schema.createTable('audit_log', table => {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('action', 50).notNullable();
    table.string('entity_type', 50).notNullable();
    table.string('entity_id', 36).notNullable();
    table.json('old_values').nullable();
    table.json('new_values').nullable();
    table.string('ip_address', 45);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['user_id', 'created_at']);
    table.index(['entity_type', 'entity_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('audit_log');
  await knex.schema.dropTableIfExists('calculated_totals');
  await knex.schema.dropTableIfExists('ai_requests');
  await knex.schema.dropTableIfExists('tools');
  await knex.schema.dropTableIfExists('materials');
  await knex.schema.dropTableIfExists('works');
  await knex.schema.dropTableIfExists('wall_sections');
  await knex.schema.dropTableIfExists('room_obstacles');
  await knex.schema.dropTableIfExists('room_segments');
  await knex.schema.dropTableIfExists('room_subsections');
  await knex.schema.dropTableIfExists('openings');
  await knex.schema.dropTableIfExists('rooms');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('units');
}
