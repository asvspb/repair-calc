# 📋 Шпаргалка по логированию

**Дата обновления:** 2026-04-16

---

## Логгеры проекта

| Среда | Логгер | Импорт |
|-------|--------|--------|
| Сервер | `winstonLogger` (Winston) | `import { winstonLogger } from '../middleware/logger.js'` |
| Клиент | `logError`, `logWarning`, `logDebug` | `import { logError, logWarning, logDebug } from '../utils/logger'` |
| Миграции | `console.log` | Только CLI-контекст |

---

## Быстрый доступ к логам

```bash
# Последние 100 строк логов
docker logs repair-calc-backend --tail 100

# Следить в реальном времени
docker logs repair-calc-backend -f

# Найти конкретный проект
docker logs repair-calc-backend 2>&1 | grep "da07594f-"

# Полный дамп (1000 строк)
docker logs repair-calc-backend --tail 1000
```

---

## Формат логов (Winston)

### HTTP-лог
```
2026-04-16 14:30:13 [info]: GET /api/sync/pull 200 14ms
```

### Лог маршрута с метаданными
```
2026-04-16 14:30:13 [info]: [POST /projects] Created project {"projectId":"da07594f-...","name":"Квартира","duration":13}
```

### Ошибка (со стек-трейсом)
```
2026-04-16 14:30:14 [error]: Request error {"errorMessage":"Project not found","errorName":"AppError"}
Error: Project not found
    at ProjectRepository.findByIdAndUserId (project.repo.ts:45:11)
```

### Предупреждение (валидация)
```
2026-04-16 14:30:15 [warn]: Validation error {"errors":[{"field":"name","message":"Обязательно","code":"too_small"}]}
```

---

## Фильтрация по уровням Winston

```bash
# Только ошибки
docker logs repair-calc-backend 2>&1 | grep "[error]"

# Ошибки и предупреждения
docker logs repair-calc-backend 2>&1 | grep -E "\[(error|warn)\]"

# Только info
docker logs repair-calc-backend 2>&1 | grep "[info]"

# Только debug
docker logs repair-calc-backend 2>&1 | grep "[debug]"
```

---

## События для отслеживания

| Событие | Искать в логах | Уровень |
|---------|---------------|---------|
| Загрузка проектов | `GET /api/sync/pull` | info |
| Создание проекта | `Created project` | info |
| Создание объекта | `Создание нового объекта` | info |
| Обновление проекта | `Project updated` | info |
| Удаление проекта | `Deleted` | info |
| Ошибка авторизации | `401` или `Invalid or expired token` | warn |
| Проект не найден | `not found` | warn |
| Конфликт версий | `Version conflict` | warn |
| Ошибка валидации | `Validation error` | warn |
| Ошибка БД | `Database connection failed` | error |
| Ошибка кеширования AI | `Failed to cache AI response` | error |

---

## Клиентский логгер (DevTools)

```javascript
// История действий (последние 100)
window.debugLogger.getHistory()
window.debugLogger.printHistory()
window.debugLogger.clearHistory()
```

Формат в DevTools:
```
▼ 📋 [12:30:13] [API] → GET /api/projects
▼ ✅ [12:30:13] [API] ← GET /api/projects (14ms)
▼ ❌ [ProjectSave] Ошибка сохранения
```

---

## Типичные проблемы

### ❌ Токен истёк
```
2026-04-16 14:30:14 [warn]: GET /api/auth/me 401 6ms {"ip":"...","userAgent":"..."}
```
**Решение:** Автоматически обновляется через `/api/auth/refresh`

### ❌ Проект не найден
```
2026-04-16 14:30:14 [warn]: [GET /projects/:id] Project not found {"projectId":"uuid"}
```
**Причина:** Удалён или неверный ID

### ❌ Конфликт версий
```
2026-04-16 14:30:14 [warn]: [PUT /projects/:id] Version conflict {"projectId":"uuid"}
```
**Решение:** Обновить данные с сервера

### ❌ Ошибка валидации (ZodError)
```
2026-04-16 14:30:15 [warn]: Validation error {"errors":[{"field":"name","message":"Обязательно","code":"too_small"}]}
```
**Причина:** Клиент отправил невалидные данные

---

## Примеры

### 1. Проверить состояние проектов
```bash
docker logs repair-calc-backend --tail 100
```

### 2. Найти все операции с проектом
```bash
docker logs repair-calc-backend 2>&1 | grep "da07594f-"
```

### 3. Найти ошибки
```bash
docker logs repair-calc-backend 2>&1 | grep "[error]"
```

### 4. Найти предупреждения
```bash
docker logs repair-calc-backend 2>&1 | grep "[warn]"
```

### 5. Посмотреть детали синхронизации
```bash
docker logs repair-calc-backend 2>&1 | grep "sync/pull"
```

### 6. Найти создание объектов
```bash
docker logs repair-calc-backend 2>&1 | grep "Создание нового объекта"
```

---

## Ссылки

- 📖 [Полная документация](./LOGGING.md)
- 🏗️ [Архитектура](./ARCHITECTURE.md)
- 🐛 [Инструкции по отладке](./DEBUG_INSTRUCTIONS.md)
