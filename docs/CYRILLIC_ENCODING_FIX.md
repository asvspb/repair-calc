# Технический план: Устранение проблем с кодировкой кириллицы в MySQL

**Дата:** 2026-03-31  
**Приоритет:** 🔴 Критический (Blocker)  
**Статус:** Требуется реализация  
**Связанные документы:** [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md), [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📋 Описание проблемы

### Текущее состояние

При работе с базой данных MySQL наблюдается **некорректное отображение кириллических символов**:

```sql
-- В MySQL Client (через Docker):
SELECT name, city FROM projects;
-- Результат: ????? ??????, ??????

-- HEX-представление:
SELECT HEX(name), HEX(city) FROM projects;
-- D09AD0B2D0B0D180D182D0B8D180D18B (Квартиры)
-- D0A1D0B0D180D0B0D182D0BED0B2 (Саратов)
```

### Диагностика

```bash
# Проверка charset переменных MySQL:
SHOW VARIABLES LIKE 'character_set%';

# Результат:
character_set_client      latin1      ❌
character_set_connection  latin1      ❌
character_set_database    utf8mb4     ✅
character_set_results     latin1      ❌
character_set_server      utf8mb4     ✅
```

### Корневая причина

**Проблема:** Клиентское соединение использует `latin1` вместо `utf8mb4`, хотя база данных и сервер настроены на `utf8mb4`.

**Почему это происходит:**
1. MySQL client при подключении по умолчанию использует `latin1`
2. Node.js MySQL2 driver не устанавливает charset явно при создании соединения
3. Knex.js конфигурация не указывает кодировку соединения

**Последствия:**
- Данные сохраняются в UTF-8 (правильно)
- При чтении через CLI — отображаются `?????`
- API возвращает данные корректно (Node.js работает с UTF-8 напрямую)
- Путаница при отладке через MySQL CLI

---

## 🎯 Цели

1. **Основная:** Настроить UTF-8 кодировку для всех соединений с БД
2. **Дополнительная:** Обеспечить корректное отображение кириллицы в MySQL CLI
3. **Профилактическая:** Добавить валидацию кодировки в тесты

---

## 🔧 План работ

### Этап 1: Настройка MySQL соединения (Node.js)

#### 1.1 Обновить `server/src/db/pool.ts`

**Файл:** `server/src/db/pool.ts`

**Изменения:**
```typescript
export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  
  // ✅ ДОБАВИТЬ: явное указание кодировки
  charset: 'utf8mb4',
  timezone: '+00:00',
  
  // ✅ СУЩЕСТВУЮЩИЕ настройки
  waitForConnections: true,
  connectionLimit: config.database.poolLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
});
```

**Обоснование:**
- `charset: 'utf8mb4'` — гарантирует UTF-8 для клиентского соединения
- `timezone: '+00:00'` — явная установка UTC для timestamp полей

---

#### 1.2 Обновить `server/knexfile.ts`

**Файл:** `server/knexfile.ts`

**Изменения:**
```typescript
const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'repair_calc',
    
    // ✅ ДОБАВИТЬ: кодировка соединения
    charset: 'utf8mb4',
    timezone: '+00:00',
  },
  pool: {
    min: 2,
    max: parseInt(process.env.DB_POOL_LIMIT || '10'),
  },
  migrations: {
    directory: './src/db/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './src/db/seeds',
    extension: 'ts',
  },
};
```

---

#### 1.3 Обновить миграции для явного указания кодировки таблиц

**Файл:** `server/src/db/migrations/20260313_initial.ts`

**Изменения для каждой таблицы:**

```typescript
await knex.schema.createTable('projects', (table) => {
  table.string('id', 36).primary();
  // ... остальные поля ...
  
  // ✅ ДОБАВИТЬ в конце:
  table.charset('utf8mb4');
  table.collate('utf8mb4_unicode_ci');
}, 'utf8mb4');

// Или альтернативный синтаксис:
await knex.schema.createTable('projects', (table) => {
  // ... поля ...
}).charset('utf8mb4').collate('utf8mb4_unicode_ci');
```

**Примечание:** Knex.js поддерживает указание charset через второй аргумент или цепочку методов.

---

### Этап 2: Настройка Docker MySQL контейнера

#### 2.1 Обновить `docker-compose.yml`

**Файл:** `docker-compose.yml`

**Изменения:**
```yaml
services:
  db:
    image: mysql:8.0
    container_name: repair-calc-db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: repair_calc
      MYSQL_USER: repair_user
      MYSQL_PASSWORD: secure_password
      
      # ✅ ДОБАВИТЬ: принудительная установка кодировки
      MYSQL_CHARSET: utf8mb4
      MYSQL_COLLATION: utf8mb4_unicode_ci
    
    # ✅ ДОБАВИТЬ: volume для конфигурации
    volumes:
      - mysql_data:/var/lib/mysql
      - ./server/mysql-conf.d:/etc/mysql/conf.d:ro
    
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
```

---

#### 2.2 Создать файл конфигурации MySQL

**Файл:** `server/mysql-conf.d/charset.cnf` (новый)

```ini
[client]
default-character-set = utf8mb4

[mysql]
default-character-set = utf8mb4

[mysqld]
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
character-set-client = utf8mb4
character-set-connection = utf8mb4
character-set-results = utf8mb4
```

**Обоснование:**
- `[client]` — настройки для всех клиентских утилит
- `[mysql]` — настройки для CLI клиента
- `[mysqld]` — настройки сервера

---

### Этап 3: Миграция существующих данных

#### 3.1 Скрипт конвертации таблиц

**Файл:** `server/scripts/fix-encoding.ts` (новый)

```typescript
import { pool } from '../src/db/pool.js';

async function fixEncoding() {
  console.log('🔧 Starting encoding fix...');
  
  const tables = [
    'users', 'projects', 'rooms', 'works', 'materials', 'tools',
    'openings', 'room_subsections', 'room_segments', 'room_obstacles',
    'wall_sections', 'ai_requests', 'audit_log'
  ];
  
  for (const table of tables) {
    try {
      // Конвертация таблицы
      await pool.execute(`
        ALTER TABLE \`${table}\`
        CONVERT TO CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
      `);
      console.log(`✅ ${table}: converted to utf8mb4`);
    } catch (error) {
      console.error(`❌ ${table}: failed -`, error);
    }
  }
  
  await pool.end();
  console.log('🎉 Encoding fix completed!');
}

fixEncoding().catch(console.error);
```

**Запуск:**
```bash
cd server
npx tsx scripts/fix-encoding.ts
```

---

#### 3.2 Проверка результатов

```bash
# Подключение к БД с явным указанием charset
docker exec -it repair-calc-db mysql -urepair_user -psecure_password repair_calc \
  --default-character-set=utf8mb4

# Проверка кодировки таблиц
SELECT 
  TABLE_NAME,
  TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'repair_calc'
  AND TABLE_NAME IN ('projects', 'rooms', 'works');

# Проверка данных
SELECT 
  id,
  name,
  city,
  HEX(name) as name_hex,
  HEX(city) as city_hex
FROM projects
ORDER BY created_at DESC;

# Ожидаемый результат:
# name_hex: D09AD0B2D0B0D180D182D0B8D180D18B (Квартиры)
# city_hex: D0A1D0B0D180D0B0D182D0BED0B2 (Саратов)
```

---

### Этап 4: Обновление переменных окружения

#### 4.1 Обновить `.env.example`

**Файл:** `.env.example`

**Добавить:**
```bash
# Database
DB_HOST=db
DB_PORT=3306
DB_USER=repair_user
DB_PASSWORD=secure_password
DB_NAME=repair_calc
DB_POOL_LIMIT=10

# ✅ ДОБАВИТЬ: кодировка
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci
DB_TIMEZONE=+00:00
```

---

#### 4.2 Обновить `server/src/config/env.ts`

**Файл:** `server/src/config/env.ts`

**Изменения:**
```typescript
export const config = {
  // ... остальные настройки ...
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'repair_calc',
    poolLimit: parseInt(process.env.DB_POOL_LIMIT || '10'),
    
    // ✅ ДОБАВИТЬ:
    charset: process.env.DB_CHARSET || 'utf8mb4',
    collation: process.env.DB_COLLATION || 'utf8mb4_unicode_ci',
    timezone: process.env.DB_TIMEZONE || '+00:00',
  },
};
```

---

### Этап 5: Тестирование

#### 5.1 Unit-тесты для кодировки

**Файл:** `server/src/db/encoding.test.ts` (новый)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from './pool.js';

describe('MySQL Encoding', () => {
  const testCyrllicData = [
    { name: 'Квартира', city: 'Саратов' },
    { name: 'Дом', city: 'Волгоград' },
    { name: 'Комната', city: 'Москва' },
    { name: 'Офис', city: 'Санкт-Петербург' },
  ];

  beforeAll(async () => {
    // Создание тестовой таблицы
    await pool.execute(`
      CREATE TEMPORARY TABLE test_encoding (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) CHARACTER SET utf8mb4,
        city VARCHAR(255) CHARACTER SET utf8mb4
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
  });

  afterAll(async () => {
    await pool.execute('DROP TEMPORARY TABLE IF EXISTS test_encoding');
  });

  it('должен корректно сохранять кириллицу', async () => {
    for (const data of testCyrllicData) {
      await pool.execute(
        'INSERT INTO test_encoding (name, city) VALUES (?, ?)',
        [data.name, data.city]
      );
    }

    const [rows] = await pool.execute('SELECT name, city FROM test_encoding');
    
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ name: 'Квартира', city: 'Саратов' });
    expect(rows[1]).toMatchObject({ name: 'Дом', city: 'Волгоград' });
  });

  it('должен корректно возвращать HEX для кириллицы', async () => {
    const [rows] = await pool.execute(`
      SELECT HEX(name) as name_hex, HEX(city) as city_hex 
      FROM test_encoding 
      WHERE name = 'Квартира'
    `);

    // Проверка HEX для "Квартира" (UTF-8)
    expect(rows[0].name_hex).toBe('D09AD0B2D0B0D180D182D0B8D180D0B0');
    expect(rows[0].city_hex).toBe('D0A1D0B0D180D0B0D182D0BED0B2');
  });

  it('должен использовать utf8mb4 для соединения', async () => {
    const [rows] = await pool.execute("SELECT @@character_set_connection as charset");
    expect(rows[0].charset).toBe('utf8mb4');
  });
});
```

---

#### 5.2 Integration-тесты API

**Файл:** `server/src/routes/projects.encoding.test.ts` (новый)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../db/pool.js';

describe('Projects API - Encoding', () => {
  let authToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Регистрация тестового пользователя
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'encoding-test@test.com',
        password: 'test123',
        name: 'Encoding Test',
      });
    
    authToken = registerRes.body.data.token;
  });

  afterAll(async () => {
    // Очистка
    if (testProjectId) {
      await pool.execute('DELETE FROM projects WHERE id = ?', [testProjectId]);
    }
    await pool.execute('DELETE FROM users WHERE email = ?', ['encoding-test@test.com']);
  });

  it('должен создавать проект с кириллическим названием', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Квартира на Голуба',
        city: 'Волгоград',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Квартира на Голуба');
    expect(res.body.data.city).toBe('Волгоград');
    
    testProjectId = res.body.data.id;
  });

  it('должен возвращать проект с корректной кириллицей', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const project = res.body.data.find((p: any) => p.id === testProjectId);
    
    expect(project.name).toBe('Квартира на Голуба');
    expect(project.city).toBe('Волгоград');
  });
});
```

---

### Этап 6: Документация и чек-лист

#### 6.1 Обновить README.md

**Файл:** `README.md` (раздел "База данных")

**Добавить:**
```markdown
### Кодировка базы данных

База данных использует кодировку `utf8mb4` для поддержки кириллицы и emoji.

**Проверка кодировки:**
```bash
docker exec -it repair-calc-db mysql -urepair_user -psecure_password repair_calc \
  --default-character-set=utf8mb4 -e "SHOW VARIABLES LIKE 'character_set%';"
```

**Ожидаемые значения:**
- `character_set_client`: utf8mb4
- `character_set_connection`: utf8mb4
- `character_set_database`: utf8mb4
- `character_set_results`: utf8mb4
```

---

#### 6.2 Чек-лист для разработчиков

**Файл:** `docs/DEVELOPER_CHECKLIST.md` (новый или обновить)

```markdown
## При работе с базой данных

### Перед запуском миграций

- [ ] Проверить, что `.env` содержит `DB_CHARSET=utf8mb4`
- [ ] Убедиться, что Docker контейнер использует `mysql-conf.d/charset.cnf`
- [ ] Запустить `docker-compose down -v` для очистки старых томов (если нужно)

### После миграций

- [ ] Проверить кодировку таблиц:
  ```sql
  SELECT TABLE_NAME, TABLE_COLLATION 
  FROM information_schema.TABLES 
  WHERE TABLE_SCHEMA = 'repair_calc';
  ```
- [ ] Протестировать сохранение кириллицы через API
- [ ] Проверить HEX-представление данных (должно быть валидным UTF-8)

### При добавлении новых полей

- [ ] Указать `CHARACTER SET utf8mb4` в миграциях
- [ ] Добавить тесты на кириллицу
```

---

## 📅 Оценка времени

| Этап | Задачи | Часы |
|------|--------|------|
| **1. Настройка Node.js** | pool.ts, knexfile.ts, миграции | 1.5 |
| **2. Настройка Docker** | docker-compose.yml, charset.cnf | 0.5 |
| **3. Миграция данных** | Скрипт конвертации, проверка | 1.0 |
| **4. Переменные окружения** | .env.example, env.ts | 0.5 |
| **5. Тестирование** | Unit + Integration тесты | 2.0 |
| **6. Документация** | README, чек-лист | 0.5 |
| **ИТОГО** | | **6 часов** |

---

## 🚀 Пошаговая инструкция по развёртыванию

### Шаг 1: Остановка сервисов

```bash
docker-compose down
```

### Шаг 2: Применение изменений

```bash
# 1. Обновить файлы конфигурации
# (pool.ts, knexfile.ts, docker-compose.yml, charset.cnf)

# 2. Пересоздать том с БД (если допустима потеря данных)
docker volume rm repair-calc_mysql_data

# ИЛИ сохранить данные и запустить скрипт миграции
# (см. Этап 3 выше)
```

### Шаг 3: Запуск сервисов

```bash
docker-compose up -d --build
```

### Шаг 4: Проверка

```bash
# Проверка кодировки соединения
docker exec repair-calc-db mysql -urepair_user -psecure_password repair_calc \
  --default-character-set=utf8mb4 -e "SELECT @@character_set_connection;"

# Ожидаемый результат: utf8mb4
```

### Шаг 5: Запуск тестов

```bash
cd server
npm test -- encoding
```

---

## ⚠️ Риски и меры предосторожности

### Риск 1: Потеря данных при конвертации

**Митигация:**
- Создать бэкап БД перед конвертацией
- Использовать временные таблицы для миграции
- Протестировать на staging окружении

### Риск 2: Несовместимость со старыми данными

**Митигация:**
- Проверить HEX-представление существующих данных
- Запустить скрипт валидации перед конвертацией
- Сохранить логи изменений

### Риск 3: Проблемы с производительностью

**Митигация:**
- `utf8mb4` использует до 4 байт на символ (vs 3 у utf8)
- Увеличить `innodb_buffer_pool_size` при необходимости
- Мониторить размер БД после миграции

---

## ✅ Критерии приёмки

- [ ] Все переменные `character_set_*` = `utf8mb4`
- [ ] MySQL CLI отображает кириллицу корректно
- [ ] API возвращает данные с кириллицей без искажений
- [ ] Unit-тесты на кодировку проходят (100%)
- [ ] Integration-тесты API проходят (100%)
- [ ] Существующие данные сконвертированы без потерь
- [ ] Документация обновлена

---

## 🔗 Полезные ссылки

- [MySQL UTF-8 Documentation](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb4.html)
- [Knex.js MySQL Configuration](https://knexjs.org/guide/#mysql)
- [mysql2 Charset Options](https://github.com/sidorares/node-mysql2#using-charset)
- [Docker MySQL UTF-8](https://hub.docker.com/_/mysql)

---

**End of Document**
