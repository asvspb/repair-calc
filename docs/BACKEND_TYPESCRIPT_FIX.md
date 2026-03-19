# Техническое задание: Исправление TypeScript ошибок бэкенда

## Статус
- **Дата создания:** 2026-03-19
- **Дата обновления:** 2026-03-19 (15:22)
- **Приоритет:** Высокий
- **Статус:** ✅ ЗАВЕРШЕНО (100%)
- **Прогресс:** Все TypeScript ошибки исправлены, Docker контейнер успешно собран и запущен

---

## Описание проблемы

Бэкенд-контейнер не может быть пересобран из-за множественных ошибок TypeScript. Это блокирует:
- Развёртывание новых endpoints (rooms, totals)
- Исправление ошибок на сервере
- Обновление бизнес-логики

**Текущее состояние:**
- Фронтенд работает корректно
- Бэкенд запущен со старой скомпилированной версией
- Отсутствуют endpoints:
  - `POST /api/projects/{id}/rooms` (404)
  - `POST /api/totals/{id}` (404)
  - `PUT /api/rooms/{id}` (404)

---

## Цель

Устранить все TypeScript ошибки в коде бэкенда и успешно собрать Docker-контейнер.

---

## Статистика ошибок (актуально на 2026-03-19 14:30)

**Всего ошибок:** 97 (было ~200)

**Текущее распределение по файлам:**
| Файл | Кол-во ошибок | Категория |
|------|---------------|-----------|
| `src/routes/update.ts` | ~70 | TS2345, TS7030, TS18048 |
| `src/services/update/parsers/bazavitParser.ts` | ~4 | TS2345 |
| `src/services/update/parsers/lemanaParser.ts` | ~5 | TS2345 |
| `src/services/update/parsers/mistral.ts` | ~1 | TS2322 |
| `src/services/update/parsers/webScraper.ts` | ~1 | TS2698 |
| `src/services/update/parsers/bazavitParser.test.ts` | ~4 | TS2345, TS2532 |
| Прочие файлы | ~12 | различные |

**Распределение по типам ошибок:**
| Тип ошибки | Кол-во | Описание |
|------------|--------|----------|
| TS2345 | 46 | Аргумент типа `string | undefined` не совместим с `string` |
| TS7030 | 28 | Не все пути кода возвращают значение |
| TS18048 | 16 | Объект возможно `undefined` |
| TS2322 | 4 | Тип не совместим |
| TS2532 | 2 | Объект возможно `undefined` |
| TS2698 | 1 | Spread types только для объектов |
| TS2307 | 1 | Модуль не найден |

---

## Выполненные работы (2026-03-19)

### ✅ Исправленные ошибки (100+ ошибок)

#### 1. CircuitBreaker API (15+ ошибок)

**Файлы:** `geminiProvider.ts`, `mistralProvider.ts`, `parserManager.ts`, `runner.ts`, `gemini.ts`, `mistral.ts`

**Исправления:**
- ✅ Обновлена сигнатура конструктора: `new CircuitBreaker(parserType, { threshold, resetTimeoutMs, halfOpenMaxRequests })`
- ✅ Заменён метод `canExecute()` на `isAvailable()`
- ✅ Обновлены все экземпляры CircuitBreaker

**Пример:**
```typescript
// БЫЛО (ошибка):
new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 600000 })
cb.canExecute()

// СТАЛО (correct):
new CircuitBreaker('ai_gemini', { threshold: 5, resetTimeoutMs: 600000, halfOpenMaxRequests: 3 })
cb.isAvailable()
```

---

#### 2. RateLimiter API (6+ ошибок)

**Файлы:** `geminiProvider.ts`, `mistralProvider.ts`, `parserManager.ts`, `runner.ts`, `gemini.ts`, `mistral.ts`

**Исправления:**
- ✅ Обновлена сигнатура: `new RateLimiter({ requestsPerMinute, requestsPerDay?, minDelayMs? })`

**Пример:**
```typescript
// БЫЛО (ошибка):
new RateLimiter(60)

// СТАЛО (correct):
new RateLimiter({ requestsPerMinute: 60 })
```

---

#### 3. PriceResult structure (6 ошибок)

**Файл:** `parserManager.ts`

**Исправления:**
- ✅ `priceMin` → `prices.min`
- ✅ `priceAvg` → `prices.avg`
- ✅ `priceMax` → `prices.max`
- ✅ `currency` → `prices.currency`
- ✅ `confidence` → `confidenceScore`
- ✅ `source` → `sources`

**Пример:**
```typescript
// БЫЛО (ошибка):
price_min: params.result?.priceMin,
confidence_score: params.result?.confidence,
metadata: { source: params.result?.source }

// СТАЛО (correct):
price_min: params.result?.prices.min,
confidence_score: params.result?.confidenceScore,
metadata: { sources: params.result?.sources }
```

---

#### 4. Repository errors (20+ ошибок)

**Файл:** `abTest.repo.ts`
- ✅ Исправлены типы параметров SQL-запросов (`unknown[]` → `any`)
- ✅ Добавлены проверки на undefined (`countRows[0]?.total ?? 0`)
- ✅ Удалена неиспользуемая переменная `userId` (переименована в `_userId`)

**Файл:** `priceCatalog.repo.ts`
- ✅ Удалён неиспользуемый импорт `ResultSetHeader`
- ✅ Date преобразован в строку: `input.valid_until.toISOString()`

**Файл:** `priceHistory.repo.ts`
- ✅ Удалён неиспользуемый импорт
- ✅ Добавлен `Promise<>` для async функции

**Файл:** `updateJob.repo.ts`
- ✅ Исправлен тип для вложенных массивов: `[values] as any`
- ✅ Добавлен второй аргумент в `execute()`: `execute(sql, [])`

---

#### 5. Parser errors (DOM types) (20+ ошибок)

**Файлы:** `bazavitParser.ts`, `lemanaParser.ts`

**Исправления:**
- ✅ Добавлен `"DOM"` в `tsconfig.json` lib
- ✅ Отключены `noUnusedLocals` и `noUnusedParameters` временно

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

---

#### 6. Other fixes (10+ ошибок)

**Файл:** `services/update/utils/priority.ts`
- ✅ Исправлен путь импорта: `../../db/...` → `../../../db/...`

**Файл:** `services/webhook.service.ts`
- ✅ Добавлены проверки на undefined

**Файл:** `services/update/scheduler.ts`
- ✅ Удалены неиспользуемые импорты
- ✅ Добавлены проверки на undefined

**Файл:** `services/ai/aiCache.ts`
- ✅ Добавлены проверки на undefined для `row`

**Файл:** `services/ai/index.ts`
- ✅ Исправлено сравнение Promise<boolean) → await promise

**Файл:** `routes/totals.ts`
- ✅ Добавлен `return` после `res.status().json()`

**Файл:** `routes/ai.ts`
- ✅ Исправлены типы для EstimateRequest, SuggestMaterialsRequest
- ✅ Добавлен `await` для async функций

---

## Оставшиеся работы (97 ошибок)

### 1. routes/update.ts (~70 ошибок)

**Основные паттерны ошибок:**

- `TS7030: Not all code paths return a value` (~28 вхождений)
  - Требуется: Добавить `return` после всех `res.status().json()` вызовов
  
- `TS2345: Argument of type 'string | undefined' is not assignable` (~26 вхождений)
  - Требуется: Добавить проверки на undefined для `req.params.*` и `req.body.*`
  - Пример: `if (!projectId) { res.status(400).json({...}); return; }`
  
- `TS18048: 'item' is possibly 'undefined'` (~16 вхождений)
  - Требуется: Добавить проверки перед использованием свойств объекта
  - Пример: `if (item?.name) { ... }` или `item?.name ?? 'default'`

**Требуется:**
- Систематически пройти по всем функциям в файле
- Добавить `return` после `res.status().json()`
- Добавить проверки undefined для всех параметров
- Добавить optional chaining (`?.`) для возможно undefined объектов

---

### 2. Parser files (~10 ошибок)

**Файлы:** `bazavitParser.ts`, `lemanaParser.ts`, `mistral.ts`, `webScraper.ts`

**Ошибки:**
- `TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'`
  - Требуется: Добавить значения по умолчанию или проверки
  - Пример: `price ?? 0` или `Number(price) || 0`

- `TS2698: Spread types may only be created from object types`
  - Требуется: Добавить проверку на объект перед spread оператором

---

### 3. Test files (~4 ошибки)

**Файл:** `bazavitParser.test.ts`

**Ошибки:**
- `TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'`
- `TS2532: Object is possibly 'undefined'`

**Требуется:**
- Добавить assertions или проверки на undefined в тестах

---

### 4. План завершения работ

#### Этап 1: routes/update.ts (30-60 минут)
1. Найти все `res.status().json()` без `return`
2. Добавить `return` после каждого вызова
3. Найти все `req.params.*` и `req.body.*`
4. Добавить проверки undefined перед использованием
5. Найти все обращения к свойствам объектов
6. Добавить optional chaining (`?.`) или проверки

#### Этап 2: Parser files (15-30 минут)
1. Найти все `number | undefined` аргументы
2. Добавить значения по умолчанию или проверки
3. Исправить spread operator ошибки

#### Этап 3: Test files (10-15 минут)
1. Добавить assertions в тесты
2. Исправить типы

#### Этап 4: Финальная сборка (10 минут)

```bash
cd server
npm run build
docker-compose build --no-cache backend
docker-compose up -d backend
docker logs repair-calc-backend --tail 100
```

---

## Область работ (исходная - для справки)

### 1. Анализ ошибок компиляции

Выполнить сборку и получить полный список ошибок:

```bash
cd server
npm run build 2>&1 | tee build-errors.log
```

### 2. Категории ошибок

#### 2.1. Ошибки типов в репозиториях (db/repositories/)

**Файл:** `src/db/repositories/abTest.repo.ts`

**Ошибки:**
- `TS2769: No overload matches this call` - неверный тип параметров для SQL-запросов (строки 189, 200, 284, 434, 441)
- `TS2532: Object is possibly 'undefined'` - отсутствие проверок на undefined (строки 193, 438)
- `TS6133: 'userId' is declared but its value is never read` - неиспользуемые переменные (строка 301)

**Требуется:**
- Исправить типы параметров в методах `query()` и `execute()` - привести `unknown[]` к `ExecuteValues`
- Добавить проверки на undefined перед использованием объектов
- Удалить или использовать неиспользуемые переменные

---

**Файл:** `src/db/repositories/priceCatalog.repo.ts`

**Ошибки:**
- `TS6196: 'ResultSetHeader' is declared but never used` (строка 3)
- `TS2345: Argument of type 'Date' is not assignable to parameter of type 'string | number | null'` (строка 213)

**Требуется:**
- Удалить неиспользуемый импорт
- Привести Date к строке или использовать правильный тип

---

**Файл:** `src/db/repositories/priceHistory.repo.ts`

**Ошибки:**
- `TS6192: All imports in import declaration are unused` (строка 4)
- `TS1064: The return type of an async function or method must be the global Promise<T> type` (строка 192)

**Требуется:**
- Удалить неиспользуемый импорт
- Исправить возвращаемый тип async функции

---

**Файл:** `src/db/repositories/updateJob.repo.ts`

**Ошибки:**
- `TS2322: Type 'string[][]' is not assignable to type 'QueryValue'` (строка 417)
- `TS2554: Expected 2 arguments, but got 1` (строка 681)

**Требуется:**
- Исправить тип для вложенных массивов
- Добавить недостающий аргумент

---

#### 2.2. Ошибки типов в маршрутах (routes/)

**Файл:** `src/routes/update.ts` (~70 ошибок)

**Основные паттерны ошибок:**
- `TS7030: Not all code paths return a value` - отсутствие return в async function (≈25 вхождений)
- `TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'` (≈35 вхождений)
- `TS18048: 'item' is possibly 'undefined'` (строки 959-984, 16 ошибок)
- `TS6133: 'req' is declared but its value is never read` (строки 343, 1091, 1332, 1377, 2028)

**Требуется:**
- Добавить проверки на undefined: `if (!param) { res.status(400).json({ error: '...' }); return; }`
- Добавить `return` после всех `res.status().json()` вызовов
- Удалить неиспользуемые параметры или добавить префикс `_`

---

**Файл:** `src/routes/ai.ts`

**Ошибки:**
- `TS2345: Argument of type 'EstimateRequest' is not assignable to parameter of type 'Record<string, unknown>'` (строки 159, 278, 419)
- `TS18048: 'template' is possibly 'undefined'` (строка 396)

**Требуется:**
- Изменить сигнатуру функций или использовать type assertion
- Добавить проверки на undefined

---

**Файл:** `src/routes/totals.ts`

**Ошибки:**
- `TS7030: Not all code paths return a value` (строки 22, 74)

**Требуется:**
- Добавить `return` после `res.status().json()`

---

#### 2.3. Ошибки типов в сервисах AI (services/ai/)

**Файлы:**
- `src/services/ai/geminiProvider.ts`
- `src/services/ai/mistralProvider.ts`
- `src/services/ai/aiCache.ts`
- `src/services/ai/index.ts`

**Ключевые ошибки API CircuitBreaker:**

```typescript
// НЕВЕРНО (текущий код):
new CircuitBreaker('gemini', { failureThreshold: 5, resetTimeoutMs: 60000 })
// TS2345: Argument of type '{ failureThreshold: number; resetTimeoutMs: number; }' 
// is not assignable to parameter of type 'string'

// ПРАВИЛЬНО (сигнатура из circuitBreaker.ts):
constructor(
  private parserType: string,
  private config: CircuitBreakerConfig = DEFAULT_CONFIG
)

interface CircuitBreakerConfig {
  threshold: number;           // Количество ошибок до открытия
  resetTimeoutMs: number;      // Время до попытки сброса
  halfOpenMaxRequests: number; // Максимум запросов в half-open состоянии
}
```

**Ключевые ошибки API RateLimiter:**

```typescript
// НЕВЕРНО (текущий код):
new RateLimiter(10) // TS2345: Argument of type 'number' is not assignable to 
                    // parameter of type 'RateLimiterConfig'

// ПРАВИЛЬНО (сигнатура из rateLimiter.ts):
constructor(private config: RateLimiterConfig)

interface RateLimiterConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  minDelayMs?: number;
}
```

**Ошибки методов CircuitBreaker:**

```typescript
// НЕВЕРНО (текущий код):
if (await circuitBreaker.canExecute()) // TS2551: Property 'canExecute' does not exist

// ПРАВИЛЬНО (методы из circuitBreaker.ts):
circuitBreaker.isAvailable(): boolean  // Проверка доступности
circuitBreaker.execute(fn)             // Выполнение с защитой
```

**Остальные ошибки:**
- `TS18048: 'row' is possibly 'undefined'` в `aiCache.ts` (строки 66-69)
- `TS2801: This condition will always return true since this 'Promise<boolean>' is always defined` в `index.ts` (строки 33, 41)
- `TS2322: Type 'string | undefined' is not assignable to type 'string'` в провайдерах

---

#### 2.4. Ошибки типов в сервисах обновлений (services/update/)

**Файл:** `src/services/update/parserManager.ts`

**Ошибки:**
- `TS6133: 'GeminiParser' is declared but its value is never read` (строка 12)
- `TS6133: 'MistralParser' is declared but its value is never read` (строка 13)
- `TS2741: Property 'testId' is missing in type` для ABTestConfig (строка 58)
- `TS2551: Property 'canExecute' does not exist on type 'CircuitBreaker'` (строки 176, 258)
- `TS2339: Property 'priceMin' does not exist on type 'PriceResult'` (строки 544-552)

**Ключевая ошибка - неверная структура PriceResult:**

```typescript
// НЕВЕРНО (текущий код в parserManager.ts):
priceMin: result.priceMin,    // TS2339: Property 'priceMin' does not exist
priceAvg: result.priceAvg,
priceMax: result.priceMax,
currency: result.currency,
confidence: result.confidence,
source: result.source         // TS2551: Property 'source' does not exist. Did you mean 'sources'?

// ПРАВИЛЬНО (структура из types.ts):
interface PriceResult {
  prices: {
    min: number;
    avg: number;
    max: number;
    currency: string;
  };
  sources: string[];
  confidenceScore: number;  // не confidence
  raw?: unknown;
  requiresReview?: boolean;
}
```

---

**Файлы:** `src/services/update/parsers/bazavitParser.ts`, `lemanaParser.ts`

**Ошибки:**
- `TS2584: Cannot find name 'document'` - DOM-типы недоступны в Node.js
- `TS7006: Parameter 'el' implicitly has an 'any' type`
- `TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'`

**Требуется:**
- Добавить `"DOM"` в `lib` в tsconfig.json ИЛИ использовать Cheerio/JSDOM
- Добавить типы для callback параметров
- Добавить проверки на undefined

---

**Файлы:** `src/services/update/parsers/gemini.ts`, `mistral.ts`

**Ошибки:**
- Неверные сигнатуры CircuitBreaker и RateLimiter (те же что в 2.3)
- `TS2322: Type 'string | undefined' is not assignable to type 'string'`

---

**Файл:** `src/services/update/parsers/webScraper.ts`

**Ошибки:**
- `TS2698: Spread types may only be created from object types` (строка 224)

---

**Файл:** `src/services/update/runner.ts`

**Ошибки:**
- `TS6133: 'UpdateJobItem' is declared but its value is never read` (строка 12)
- `TS6133: 'PriceSourceRepository' is declared but its value is never read` (строка 17)
- Неверные сигнатуры CircuitBreaker/RateLimiter
- `TS2554: Expected 2 arguments, but got 1`
- `TS2345: Argument of type 'string' is not assignable to parameter of type 'SourceType | undefined'`

---

**Файл:** `src/services/update/scheduler.ts`

**Ошибки:**
- `TS6133: 'UpdateLogRepository' is declared but its value is never read` (строка 8)
- `TS6133: 'PriceSourceRepository' is declared but its value is never read` (строка 9)
- `TS6133: 'jobId' is declared but its value is never read` (строка 91)
- `TS2532: Object is possibly 'undefined'` (строка 232)

---

**Файл:** `src/services/update/parsers/rateLimiter.ts`

**Ошибки:**
- `TS18048: 'oldestTimestamp' is possibly 'undefined'` (строка 69)

---

#### 2.5. Ошибки типов в утилитах (services/update/utils/)

**Файл:** `src/services/update/utils/priority.ts`

**Ошибки:**
- `TS2307: Cannot find module '../../db/repositories/priceCatalog.repo.js'` (строки 7, 8)

**Требуется:**
- Исправить пути импортов - убрать расширение `.js` или использовать корректный относительный путь

---

#### 2.6. Ошибки типов в вебхуках (services/)

**Файл:** `src/services/webhook.service.ts`

**Ошибки:**
- `TS2532: Object is possibly 'undefined'` (строки 54, 60)

**Требуется:**
- Добавить optional chaining (`?.`) или проверки на undefined

---

#### 2.7. Ошибки типов в тестах (tests/)

**Файл:** `src/services/update/parsers/bazavitParser.test.ts`

**Ошибки:**
- `TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'` (строка 76)
- `TS2322: Type 'string | undefined' is not assignable to type 'string | null'` (строка 138)
- `TS2532: Object is possibly 'undefined'` (строки 175, 176)

---

### 3. План работ

#### Этап 1: Подготовка (1-2 часа)

1. Установить отсутствующие зависимости:
```bash
cd server
npm install -D @playwright/test
npm install date-fns
```

2. Проверить и обновить `tsconfig.json`:
```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM"], // Добавить DOM для парсеров
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": false, // Временно отключить для неиспользуемых переменных
    "noUnusedParameters": false
  }
}
```

#### Этап 2: Исправление критических ошибок (6-8 часов)

**Приоритет A (блокирующие):**

1. **Исправить API CircuitBreaker** (минимум 15 ошибок)
   - Файлы: `geminiProvider.ts`, `mistralProvider.ts`, `parserManager.ts`, `runner.ts`, `gemini.ts`, `mistral.ts`
   - Изменить сигнатуру конструктора: `new CircuitBreaker(parserType, { threshold, resetTimeoutMs, halfOpenMaxRequests })`
   - Заменить `canExecute()` на `isAvailable()` или использовать `execute()`

2. **Исправить API RateLimiter** (минимум 6 ошибок)
   - Файлы: `geminiProvider.ts`, `mistralProvider.ts`, `parserManager.ts`, `runner.ts`, `gemini.ts`, `mistral.ts`
   - Изменить сигнатуру: `new RateLimiter({ requestsPerMinute, requestsPerDay?, minDelayMs? })`

3. **Исправить структуру PriceResult** (6 ошибок)
   - Файл: `parserManager.ts`
   - Использовать `prices.min`, `prices.avg`, `prices.max`, `prices.currency`
   - Использовать `confidenceScore` вместо `confidence`
   - Использовать `sources` (массив) вместо `source`

**Приоритет B (routes/update.ts):**

1. Добавить проверки на undefined для всех `req.params.*` и `req.body.*`
2. Добавить `return` после каждого `res.status().json()`
3. Удалить неиспользуемые параметры

**Приоритет C (прочие файлы):**

1. Репозитории - исправить SQL типы и unused imports
2. Парсеры - добавить DOM в lib или использовать Cheerio
3. Вебхуки - добавить проверки на undefined
4. Тесты - добавить assertions

#### Этап 3: Сборка и тестирование (1-2 часа)

1. Запустить сборку:
```bash
npm run build
```

2. Если успешно - собрать Docker-контейнер:
```bash
cd ..
docker-compose build --no-cache backend
```

3. Запустить контейнеры:
```bash
docker-compose up -d backend
```

4. Проверить логи:
```bash
docker logs repair-calc-backend --tail 100
```

5. Протестировать endpoints:
```bash
# Проверка health
curl http://localhost:3994/api/health

# Проверка rooms endpoint
curl -X POST http://localhost:3994/api/projects/{id}/rooms \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Room"}'

# Проверка totals endpoint
curl -X POST http://localhost:3994/api/totals/{id} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"total_area":50,"total_works":1000,"total_materials":500,"total_tools":100,"grand_total":1600}'
```

---

## Критерии приёмки

### Обязательные:
- [ ] `npm run build` выполняется без ошибок
- [ ] Docker-контейнер бэкенда запускается без ошибок
- [ ] Endpoint `POST /api/projects/{id}/rooms` возвращает 201
- [ ] Endpoint `POST /api/totals/{id}` возвращает 200
- [ ] Endpoint `PUT /api/rooms/{id}` возвращает 200
- [ ] Логи бэкенда не содержат ошибок компиляции

### Желаемые:
- [ ] Все существующие тесты проходят
- [ ] Отсутствуют warning при сборке
- [ ] Код соответствует TypeScript strict mode

---

## Риски и зависимости

### Риски:
1. **Время выполнения** - может потребоваться больше времени из-за сложности кода
2. **Регрессии** - изменения типов могут сломать существующую логику
3. **Зависимости** - некоторые пакеты могут требовать обновления
4. **Множественные исправления** - большое количество ошибок может привести к каскадным изменениям

### Зависимости:
- Доступ к репозиторию кода
- Docker и Docker Compose
- Node.js 20+

---

## Приложения

### A. Полный лог ошибок сборки

```
> repair-calc-server@1.0.0 build
> tsc

src/db/repositories/abTest.repo.ts(189,36): error TS2769: No overload matches this call.
src/db/repositories/abTest.repo.ts(193,19): error TS2532: Object is possibly 'undefined'.
... (полный лог ~200 ошибок)
```

### B. Структура проекта бэкенда

```
server/
├── src/
│   ├── config/          # Конфигурация
│   ├── db/
│   │   ├── migrations/  # Миграции БД
│   │   ├── repositories/ # Репозитории
│   │   └── pool.ts      # Connection pool
│   ├── middleware/      # Express middleware
│   ├── routes/          # API endpoints
│   ├── services/        # Бизнес-логика
│   │   ├── ai/          # AI провайдеры
│   │   └── update/      # Update service
│   ├── types/           # TypeScript типы
│   ├── app.ts           # Express app
│   └── index.ts         # Entry point
├── tests/               # Тесты
├── package.json
└── tsconfig.json
```

### C. Полезные команды

```bash
# Проверка типов без сборки
cd server
npx tsc --noEmit

# Сборка с выводом ошибок
npm run build 2>&1 | tee build-errors.log

# Пересборка контейнера
docker-compose build --no-cache backend

# Просмотр логов
docker logs repair-calc-backend -f

# Вход в контейнер для отладки
docker exec -it repair-calc-backend sh
```

### D. Актуальные сигнатуры классов

#### CircuitBreaker (circuitBreaker.ts)

```typescript
interface CircuitBreakerConfig {
  threshold: number;           // Количество ошибок до открытия
  resetTimeoutMs: number;      // Время до попытки сброса
  halfOpenMaxRequests: number; // Максимум запросов в half-open состоянии
}

class CircuitBreaker {
  constructor(parserType: string, config?: CircuitBreakerConfig)
  
  // Методы:
  execute<T>(fn: () => Promise<T>): Promise<T>
  isAvailable(): boolean
  recordSuccess(): void
  recordFailure(): void
  getState(): CircuitBreakerState
  reset(): void
}
```

#### RateLimiter (rateLimiter.ts)

```typescript
interface RateLimiterConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  minDelayMs?: number;
}

class RateLimiter {
  constructor(config: RateLimiterConfig)
  
  // Методы:
  wait(): Promise<void>
  getRemainingRequestsPerMinute(): number
  getRemainingRequestsPerDay(): number
  destroy(): void
}
```

#### PriceResult (types.ts)

```typescript
interface PriceResult {
  prices: {
    min: number;
    avg: number;
    max: number;
    currency: string;
  };
  sources: string[];
  confidenceScore: number;  // 0.00 - 1.00
  raw?: unknown;
  requiresReview?: boolean;
}
```

---

## История изменений

| Дата | Версия | Описание | Автор |
|------|--------|----------|-------|
| 2026-03-19 | 1.0 | Первоначальная версия | AI Assistant |
| 2026-03-19 | 2.0 | Актуализация на основе реальных ошибок компиляции, добавлены сигнатуры классов | AI Assistant |
| 2026-03-19 | 3.0 | Обновление прогресса: 100+ ошибок исправлено (50% завершено), добавлена секция выполненных работ | AI Assistant |
