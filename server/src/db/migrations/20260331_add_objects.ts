import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

/**
 * Миграция для добавления многоуровневой структуры:
 * Проект → Объект → Комната
 * 
 * Изменения:
 * 1. Таблица objects — единицы недвижимости в проекте
 * 2. Таблица deleted_entities — отслеживание удалений (30 дней)
 * 3. is_premium в users — флаг премиум-доступа
 * 4. object_id в rooms — связь комнат с объектами
 * 5. Миграция данных — объединение проектов в группу "Мои объекты"
 */

export async function up(knex: Knex): Promise<void> {
  // ═══════════════════════════════════════════════════════
  // 0. Таблица для отслеживания удалённых сущностей
  // ═══════════════════════════════════════════════════════
  const hasDeletedEntities = await knex.schema.hasTable('deleted_entities');
  if (!hasDeletedEntities) {
    await knex.schema.createTable('deleted_entities', (table) => {
      table.string('id', 36).primary();
      table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.enum('entity_type', ['project', 'object', 'room', 'work', 'material', 'tool']).notNullable();
      table.string('entity_id', 36).notNullable();
      table.json('snapshot').nullable();
      table.timestamp('deleted_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable();
      
      table.index(['user_id', 'deleted_at'], 'idx_deleted_entities_user');
      table.index(['expires_at'], 'idx_deleted_entities_expire');
    });
  }

  // ═══════════════════════════════════════════════════════
  // 1. Таблица objects
  // ═══════════════════════════════════════════════════════
  const hasObjects = await knex.schema.hasTable('objects');
  if (!hasObjects) {
    await knex.schema.createTable('objects', (table) => {
      table.string('id', 36).primary();
      table.string('project_id', 36).notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');

      table.string('name', 255).notNullable();
      table.string('city', 100).nullable();
      table.string('address', 500).nullable();

      table.boolean('use_ai_pricing').defaultTo(false);
      table.timestamp('last_ai_price_update').nullable();

      table.integer('version').defaultTo(1);
      table.integer('sort_order').defaultTo(0);

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();

      table.index(['project_id'], 'idx_object_project_id');
      table.index(['user_id'], 'idx_object_user_id');
      table.index(['project_id', 'sort_order'], 'idx_project_sort');
      table.index(['deleted_at'], 'idx_object_deleted');
    });
  }

  // ═══════════════════════════════════════════════════════
  // 2. Добавляем object_id в rooms
  // ═══════════════════════════════════════════════════════
  const hasObjectId = await knex.schema.hasColumn('rooms', 'object_id');
  if (!hasObjectId) {
    await knex.schema.alterTable('rooms', (table) => {
      table.string('object_id', 36).nullable().after('id');
      table.index(['object_id'], 'idx_room_object_id');
      table.index(['object_id', 'sort_order'], 'idx_object_sort');
    });
  } else {
    // Добавляем индексы отдельно если колонка уже есть
    try {
      await knex.schema.alterTable('rooms', (table) => {
        table.index(['object_id'], 'idx_room_object_id');
      });
    } catch (e) {
      // Индекс уже существует - игнорируем
    }
    try {
      await knex.schema.alterTable('rooms', (table) => {
        table.index(['object_id', 'sort_order'], 'idx_object_sort');
      });
    } catch (e) {
      // Индекс уже существует - игнорируем
    }
  }

  // ═══════════════════════════════════════════════════════
  // 3. Добавляем is_premium в users
  // ═══════════════════════════════════════════════════════
  const hasIsPremium = await knex.schema.hasColumn('users', 'is_premium');
  if (!hasIsPremium) {
    await knex.schema.alterTable('users', (table) => {
      table.boolean('is_premium').defaultTo(false).after('email');
      table.timestamp('premium_expires_at').nullable().after('is_premium');
    });
  }

  // ═══════════════════════════════════════════════════════
  // 4. Добавляем description в projects
  // ═══════════════════════════════════════════════════════
  const hasDescription = await knex.schema.hasColumn('projects', 'description');
  if (!hasDescription) {
    await knex.schema.alterTable('projects', (table) => {
      table.text('description').nullable();
    });
  }

  // ═══════════════════════════════════════════════════════
  // 5. Миграция данных (только если есть проекты для миграции)
  // ═══════════════════════════════════════════════════════
  await migrateExistingData(knex);

  // ═══════════════════════════════════════════════════════
  // 6. Добавляем внешний ключ на object_id (если не существует)
  // ═══════════════════════════════════════════════════════
  // Проверяем существует ли FK
  const fkExists = await knex.raw(`
    SELECT COUNT(*) as count FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND CONSTRAINT_NAME = 'rooms_object_id_foreign'
    AND TABLE_NAME = 'rooms'
  `);
  
  if (fkExists[0].count === 0) {
    await knex.schema.alterTable('rooms', (table) => {
      table.foreign('object_id').references('id').inTable('objects').onDelete('CASCADE');
    });
  }
}

/**
 * Миграция существующих данных:
 * - Создаёт проект-группу "Мои объекты" для каждого пользователя
 * - Переносит проекты в объекты
 * - Переносит комнаты в объекты
 */
async function migrateExistingData(knex: Knex): Promise<void> {
  console.log('🔄 [MIGRATION] Начало миграции данных...');
  
  // Получаем всех пользователей
  const users = await knex('users').select('id', 'email');
  console.log(`📊 [MIGRATION] Найдено пользователей: ${users.length}`);
  
  let migratedProjectsCount = 0;
  let migratedRoomsCount = 0;
  
  for (const user of users) {
    // Получаем все активные проекты пользователя
    const oldProjects = await knex('projects')
      .where('user_id', user.id)
      .whereNull('deleted_at')
      .select('id', 'name', 'city', 'use_ai_pricing', 'last_ai_price_update', 'created_at');
    
    if (oldProjects.length === 0) {
      console.log(`  ⏭️  [MIGRATION] Пользователь ${user.email} — нет проектов для миграции`);
      continue;
    }
    
    console.log(`  📦 [MIGRATION] Пользователь ${user.email} — миграция ${oldProjects.length} проектов`);
    
    // 1. Создаём проект-группу "Мои объекты"
    const defaultProjectId = uuidv4();
    await knex('projects').insert({
      id: defaultProjectId,
      user_id: user.id,
      name: 'Мои объекты',
      description: 'Автоматически созданный проект при миграции',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    
    // 2. Для каждого старого проекта создаём объект
    for (const oldProject of oldProjects) {
      const objectId = uuidv4();
      
      await knex('objects').insert({
        id: objectId,
        project_id: defaultProjectId,
        user_id: user.id,
        name: oldProject.name,
        city: oldProject.city,
        use_ai_pricing: oldProject.use_ai_pricing || false,
        last_ai_price_update: oldProject.last_ai_price_update,
        version: 1,
        sort_order: 0,
        created_at: oldProject.created_at || knex.fn.now(),
        updated_at: knex.fn.now(),
      });
      
      // 3. Переносим комнаты в новый объект
      const roomsResult = await knex('rooms')
        .where('project_id', oldProject.id)
        .update({
          object_id: objectId,
          updated_at: knex.fn.now(),
        });
      
      migratedRoomsCount += roomsResult;
      migratedProjectsCount++;
      
      console.log(`    ✅ [MIGRATION] Объект "${oldProject.name}" — ${roomsResult} комнат`);
      
      // 4. Помечаем старый проект как удалённый
      await knex('projects')
        .where('id', oldProject.id)
        .update({
          deleted_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
    }
  }
  
  console.log(`✅ [MIGRATION] Завершено: ${migratedProjectsCount} проектов, ${migratedRoomsCount} комнат`);
}

export async function down(knex: Knex): Promise<void> {
  console.log('⏮️  [ROLLBACK] Начало отката миграции...');
  
  // Откат в обратном порядке
  
  // 1. Удаляем внешний ключ
  await knex.schema.alterTable('rooms', (table) => {
    table.dropForeign('object_id', 'rooms_object_id_foreign');
  });

  // 2. Очищаем object_id в rooms
  await knex('rooms').update('object_id', null);

  // 3. Восстанавливаем project_id в rooms из objects
  // Примечание: это упрощённый откат, в реальности может потребоваться более сложная логика
  await knex.raw(`
    UPDATE rooms r
    JOIN objects o ON r.object_id = o.id
    SET r.project_id = o.project_id
  `);

  // 4. Восстанавливаем проекты из объектов (помечаем как активные)
  await knex.raw(`
    UPDATE projects p
    JOIN objects o ON p.id = o.project_id
    SET p.deleted_at = NULL
    WHERE p.name = 'Мои объекты'
  `);

  // 5. Удаляем таблицу deleted_entities
  await knex.schema.dropTableIfExists('deleted_entities');
  
  // 6. Удаляем таблицу objects
  await knex.schema.dropTableIfExists('objects');

  // 7. Удаляем is_premium из users
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_premium');
    table.dropColumn('premium_expires_at');
  });

  // 8. Удаляем description из projects
  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('description');
  });

  console.log('✅ [ROLLBACK] Завершено');
}
