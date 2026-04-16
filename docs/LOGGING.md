# 📋 Руководство по логированию

**Дата обновления:** 2026-04-16
**Версия:** 2.0

---

## Обзор

Проект использует **два структурированных логгера** вместо прямых вызовов `console.*`:

| Среда | Логгер | Модуль | Уровни |
|-------|--------|--------|--------|
| **Сервер** | `winstonLogger` (Winston) | `server/src/middleware/logger.ts` | `error`, `warn`, `info`, `debug` |
| **Клиент** | Функции логирования | `src/utils/logger.ts` | `error`, `warning`, `info`, `success`, `debug` |
| **Миграции Knex** | `console.log` | — | Только CLI-контекст, вне Express |

> **Важно:** Прямые вызовы `console.*` в клиенте и сервере заменены на структурированные логгеры. Для предотвращения возврата к `console.*` планируется добавить ESLint правило `no-console`.

---

## 1. Серверное логирование (Winston)

### 1.1 Конфигурация

```typescript
// server/src/middleware/logger.ts
import winston from 'winston';
import { config } from '../config/env.js';

export const winstonLogger = winston.createLogger({
  level: config.logging.level,  // Управляется через env
  format: combine(
    errors({ stack: true }),     // Автоматический стек-трейс
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(errors({ stack: true }), colorize(), timestamp(), logFormat),
    }),
  ],
});
```

### 1.2 Формат логов

#### Стандартный HTTP-лог (middleware)
```
2026-04-16 14:30:13 [info]: GET /api/sync/pull 200 14ms
```

#### Лог с метаданными (маршруты)
```
2026-04-16 14:30:13 [info]: [POST /projects] Created project {"projectId":"da07594f-...","name":"Квартира","duration":13}
```

#### Лог ошибки (со стек-трейсом)
```
2026-04-16 14:30:14 [error]: Request error {"errorMessage":"Project not found","errorName":"AppError"}
2026-04-16 14:30:14 [debug]: Request error details {"error":{...}}
Error: Project not found
    at ProjectRepository.findByIdAndUserId (project.repo.ts:45:11)
    ...
```

#### Ошибка валидации (ZodError)
```
2026-04-16 14:30:15 [warn]: Validation error {"errors":[{"field":"name","message":"Обязательно","code":"too_small"}]}
```

### 1.3 Использование в маршрутах

```typescript
import { winstonLogger } from '../middleware/logger.js';

// Информационный лог
winstonLogger.info('[POST /projects] Created project', {
  projectId: project.id,
  name: project.name,
  duration: Date.now() - startTime,
});

// Предупреждение
winstonLogger.warn('[GET /projects/:id] Project not found', { projectId: id });

// Ошибка
winstonLogger.error('[POST /projects] Error', { duration: Date.now() - startTime, error });
```

### 1.4 Преимущества Winston над console.*

| Свойство | `console.*` | `winstonLogger` |
|----------|-------------|-----------------|
| Уровни логирования | Нет фильтрации | `config.logging.level` — отключает debug на проде |
| Структурированные данные | Строковая интерполяция | JSON-объекты — парсимые ELK/Grafana |
| Стек-трейсы | `console.error(err)` теряет стек | `errors({ stack: true })` сохраняет стек |
| Транспорты | Только консоль | Файл, syslog, Elasticsearch, Datadog |
| Форматирование | Ручное | `printf`, `colorize`, `timestamp` |
| Ротация логов | Нет | `winston-daily-rotate-file` *(планируется)* |
| Контекст запроса | Разрозненные логи | Единый HTTP-логгер + контекст в маршрутах |

---

## 2. Клиентское логирование

### 2.1 Модуль `src/utils/logger.ts`

Клиентский логгер обеспечивает **структурированное логирование** с категориями, контекстом и историей действий.

#### Основные функции

| Функция | Назначение | Уровень |
|---------|-----------|---------|
| `logError(category, action, error, data?)` | Ошибка | error |
| `logWarning(category, action, data?)` | Предупреждение | warning |
| `logDebug(category, action, data?)` | Отладка | debug |
| `logSuccess(category, action, data?, startTime?)` | Успех | success |
| `logUserAction(action, data?)` | Действие пользователя | info |
| `logApiRequest(method, endpoint, data?)` | → API запрос | info |
| `logApiSuccess(method, endpoint, startTime, data?)` | ← API ответ | success |
| `logApiError(method, endpoint, startTime, error)` | ← API ошибка | error |
| `logStateChange(component, change, newValue, oldValue?)` | Изменение состояния | info |
| `logProjectSave(source, projectId, roomsCount, startTime)` | Сохранение проекта | success/info |

### 2.2 Формат логов в браузере

Логи выводятся в DevTools через `console.groupCollapsed()` — компактно, раскрываются по клику:

```
▼ 📋 [12:30:13.456] [API] → GET /api/projects
    📦 Данные: {projectId: "da07594f-..."}

▼ ✅ [12:30:13.470] [API] ← GET /api/projects (14ms)
    📦 Данные: {count: 2}

▼ ❌ [ProjectSave] Ошибка сохранения
    🚨 Ошибка: NetworkError
    📦 Контекст: {source: "server", projectId: "..."}
```

### 2.3 Настройки

```typescript
const LOG_CONFIG = {
  enabled: true,           // Глобальный переключатель
  showTimestamp: true,      // Показывать время
  showDuration: true,       // Показывать длительность
  groupRelated: true,       // Группировать логи
  maxDataLength: 1000,      // Усечь длинные данные
};
```

### 2.4 История действий

Логгер хранит последние 100 операций, доступных через консоль браузера:

```javascript
// В DevTools:
window.debugLogger.getHistory()    // Массив последних 100 действий
window.debugLogger.printHistory()  // Вывести в консоль
window.debugLogger.clearHistory()  // Очистить
```

### 2.5 Использование в компонентах

```typescript
import { logError, logWarning, logDebug, logApiRequest, logApiSuccess, logApiError } from '../utils/logger';

// Ошибка
logError('ProjectContext', 'saveProject', error, { projectId });

// Предупреждение
logWarning('Sync', 'Version conflict', { clientVersion, serverVersion });

// Отладка
logDebug('RoomEditor', 'Geometry change', { mode, dimensions });

// API запрос
const startTime = logApiRequest('GET', '/api/projects');
try {
  const data = await fetchProjects();
  logApiSuccess('GET', '/api/projects', startTime, data);
} catch (error) {
  logApiError('GET', '/api/projects', startTime, error);
}
```

---

## 3. Эндпоинты с логированием

### 3.1 Серверные маршруты

Все маршруты логируют через `winstonLogger`:

| Маршрут | Логируемые данные |
|---------|-------------------|
| `GET /api/sync/pull` | userId, count, duration |
| `POST /api/projects` | projectId, name, duration |
| `GET /api/projects` | count, duration |
| `GET /api/projects/:id` | projectId, name, objectsCount, duration |
| `PUT /api/projects/:id` | projectId, version, duration |
| `DELETE /api/projects/:id` | projectId, name, duration |
| `POST /api/projects/:projectId/objects` | projectId, name, city, objectId, duration |
| `GET /api/objects` | userId, count, duration |
| `GET /api/objects/:id` | id, roomsCount, duration |
| `PUT /api/objects/:id` | id, duration |
| `DELETE /api/objects/:id` | id, name, duration |
| `POST /api/ai/estimate` | provider, duration |
| `POST /api/ai/suggest-materials` | provider, duration |

### 3.2 Middleware логирование

HTTP-логгер (`logger()` middleware) автоматически логирует все запросы:

- `status >= 400` → `winstonLogger.warn()` с IP и User-Agent
- `status < 400` → `winstonLogger.info()`

### 3.3 Обработка ошибок

ErrorHandler middleware логирует через `winstonLogger`:

```typescript
winstonLogger.error('Request error', { errorMessage: err.message, errorName: err.name });
winstonLogger.debug('Request error details', { error: err });

if (err instanceof ZodError) {
  winstonLogger.warn('Validation error', {
    errors: err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    })),
  });
}
```

---

## 4. Исключения: Knex-миграции

Миграции Knex выполняются в CLI-контексте (вне Express), поэтому они **оставлены на `console.log`**:

```
[MIGRATION] Начало миграции данных
[MIGRATION] Найдено пользователей: 2
[MIGRATION] Пользователь user@email — миграция 3 проектов
[MIGRATION] Объект "Квартира" — 5 комнат
[MIGRATION] Завершено: 3 проектов, 15 комнат
```

> **Причина:** Winston инициализируется в контексте Express-приложения. Миграции запускаются через `knex migrate:run` — отдельный CLI-процесс.

---

## 5. Утилиты для работы с логами

### Docker

```bash
# Последние 100 строк
docker logs repair-calc-backend --tail 100

# Логи в реальном времени
docker logs repair-calc-backend --tail 50 -f

# Полный дамп
docker logs repair-calc-backend --tail 1000
```

### Фильтрация (Winston JSON-формат)

```bash
# Найти операции с конкретным проектом
docker logs repair-calc-backend 2>&1 | grep "da07594f-"

# Только ошибки и предупреждения
docker logs repair-calc-backend 2>&1 | grep -E "\[(error|warn)\]"

# Только валидационные ошибки
docker logs repair-calc-backend 2>&1 | grep "Validation error"

# Запросы конкретного эндпоинта
docker logs repair-calc-backend 2>&1 | grep "POST /projects"

# Ошибки авторизации
docker logs repair-calc-backend 2>&1 | grep -E "(401|Invalid or expired token)"
```

### Клиент (DevTools)

```javascript
// В браузере:
window.debugLogger.getHistory()    // Массив последних 100 действий
window.debugLogger.printHistory()  // Вывести в консоль
window.debugLogger.clearHistory()  // Очистить историю
```

---

## 6. Мониторинг

### Ключевые метрики для отслеживания

1. **Время ответа API** (логируется в `duration` ms)
   - Норма: < 100ms
   - Внимание: 100-500ms
   - Критично: > 500ms

2. **Ошибки валидации** (ZodError → `warn` level)
   - Единичные: норма
   - Массовые: проблема на клиенте

3. **401 ошибки** (токен истёк)
   - Единичные: норма, клиент обновит токен
   - Массовые: проблема JWT-конфигурации

4. **Конфликты версий** (optimistic locking)
   - Единичные: норма
   - Массовые: проблема синхронизации

---

## 7. Безопасность

Логи содержат:
- ✅ ID пользователей
- ✅ ID проектов, объектов, комнат
- ✅ Названия проектов
- IP-адреса (только при `status >= 400`)
- ✅ User-Agent (только при `status >= 400`)
- ❌ **НЕ содержат** пароли, токены, персональные данные

---

## 8. Планы развития

- [ ] Добавить ESLint правило `no-console` для предотвращения новых `console.*`
- [ ] Подключить `winston-daily-rotate-file` для ротации файлов на сервере
- [ ] Добавить транспорт Winston в файл/удалённый сервис для продакшена
- [ ] Настроить структурированный JSON-вывод для ELK/Grafana Loki

---

## 📚 Связанные документы

- [LOGGING-CHEATSHEET.md](./LOGGING-CHEATSHEET.md) — Шпаргалка по логам
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Архитектура проекта
- [DEBUG_INSTRUCTIONS.md](./DEBUG_INSTRUCTIONS.md) — Инструкции по отладке

---

**Версия документации:** 2.0
**Дата обновления:** 2026-04-16
