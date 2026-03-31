# Быстрое руководство: Исправление кодировки кириллицы

## ⚡ Экстренное исправление (если данные уже повреждены)

### Шаг 1: Остановка сервисов
```bash
docker-compose down
```

### Шаг 2: Запуск скрипта фиксации
```bash
cd server
npx tsx scripts/fix-encoding.ts
```

### Шаг 3: Перезапуск с новой конфигурацией
```bash
docker-compose up -d --build
```

### Шаг 4: Проверка
```bash
# Подключение к БД с правильной кодировкой
docker exec -it repair-calc-db mysql -urepair_user -psecure_password repair_calc \
  --default-character-set=utf8mb4

# Проверка данных
SELECT name, city, HEX(name) as name_hex FROM projects;
```

---

## 📋 Плановое развёртывание (с потерей данных)

Если данные можно потерять (разработка/тестирование):

### Шаг 1: Остановка и очистка томов
```bash
docker-compose down -v
```

### Шаг 2: Запуск с чистой БД
```bash
docker-compose up -d --build
```

### Шаг 3: Запуск миграций
```bash
docker-compose up migrate
```

### Шаг 4: Проверка кодировки
```bash
docker exec -it repair-calc-db mysql -urepair_user -psecure_password repair_calc \
  --default-character-set=utf8mb4 -e "SHOW VARIABLES LIKE 'character_set%';"
```

**Ожидаемый результат:**
```
character_set_client      utf8mb4
character_set_connection  utf8mb4
character_set_database    utf8mb4
character_set_results     utf8mb4
character_set_server      utf8mb4
```

---

## 🧪 Запуск тестов

```bash
cd server
npm test -- encoding
```

---

## 🔍 Диагностика проблем

### Проблема: Данные всё ещё отображаются как ?????

**Причина:** MySQL CLI использует latin1 по умолчанию

**Решение:**
```bash
# Всегда используйте --default-character-set=utf8mb4
docker exec -it repair-calc-db mysql \
  -urepair_user -psecure_password repair_calc \
  --default-character-set=utf8mb4
```

### Проблема: Скрипт fix-encoding.ts падает с ошибкой

**Причина:** Таблица не существует или уже имеет utf8mb4

**Решение:**
```bash
# Проверка текущей кодировки таблиц
docker exec -it repair-calc-db mysql -urepair_user -psecure_password repair_calc \
  --default-character-set=utf8mb4 -e "
    SELECT TABLE_NAME, TABLE_COLLATION 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = 'repair_calc';
  "
```

### Проблема: API возвращает ????? вместо кириллицы

**Причина:** Backend не использует UTF-8 в соединении

**Решение:**
1. Проверить, что `.env` содержит `DB_CHARSET=utf8mb4`
2. Пересобрать backend: `docker-compose build backend`
3. Перезапустить: `docker-compose restart backend`

---

## ✅ Чек-лист успешного применения

- [ ] Все `character_set_*` = `utf8mb4`
- [ ] MySQL CLI отображает кириллицу (не ?????)
- [ ] HEX-представление корректное (начинается с D0xx...)
- [ ] API возвращает данные с кириллицей
- [ ] Тесты `encoding.test.ts` проходят
- [ ] Скрипт `fix-encoding.ts` выполнился без ошибок

---

## 📚 Дополнительные материалы

- [Полная спецификация](./CYRILLIC_ENCODING_FIX.md)
- [Скрипт миграции](../server/scripts/fix-encoding.ts)
- [Тесты кодировки](../server/src/db/encoding.test.ts)
- [Конфигурация MySQL](../server/mysql-conf.d/charset.cnf)
