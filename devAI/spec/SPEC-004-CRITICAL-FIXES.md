# 📋 Техническое задание: Устранение наиважнейших недостатков
## SPEC-004-CRITICAL-FIXES — Критические исправления и архитектурный рефакторинг

**Версия:** 1.0  
**Дата создания:** 2025-07-09  
**Статус:** К утверждению  
**Автор:** Buffy (AI-ассистент)  
**Основание:** CODE_REVIEW.md v5.1, TODO.md, PROGRESS.md, E2E_TEST_STATUS.md, ARCHITECTURE.md  

---

## Содержание

1. [Резюме](#1-резюме)
2. [Критерии отбора](#2-критерии-отбора)
3. [Проблема P0-SEC: Утечка API-ключей в клиентский бандл](#3-проблема-p0-sec-утечка-api-ключей-в-клиентский-бандл)
4. [Проблема P0-SEC2: 19 admin-эндпоинтов без проверки прав](#4-проблема-p0-sec2-19-admin-эндпоинтов-без-проверки-прав)
5. [Проблема P1-ARCH: God Module — ProjectContext (982 строки)](#5-проблема-p1-arch-god-module--projectcontext-982-строки)
6. [Проблема P1-ARCH2: Stale closures в deleteRoom/addRoom/reorderRooms](#6-проблема-p1-arch2-stale-closures-в-deleteroomaddroomreorderrooms)
7. [Проблема P1-ARCH3: God File — routes/update.ts (2184 строки)](#7-проблема-p1-arch3-god-file--routesupdatets-2184-строки)
8. [Проблема P1-ARCH4: God Module — ApiStorageProvider (1036 строк)](#8-проблема-p1-arch4-god-module--apistorageprovider-1036-строк)
9. [Проблема P1-ARCH5: God Component — RoomEditor (902 строки)](#9-проблема-p1-arch5-god-component--roomeditor-902-строки)
10. [Проблема P1-ARCH6: God Component — BackupManager (837 строк)](#10-проблема-p1-arch6-god-component--backupmanager-837-строк)
11. [Проблема P1-CODE: Дублирование генерации ID (4+ способов)](#11-проблема-p1-code-дублирование-генерации-id-4-способов)
12. [Проблема P1-CODE2: Magic strings для localStorage keys](#12-проблема-p1-code2-magic-strings-для-localstorage-keys)
13. [Проблема P2-TEST: E2E-тесты — 50/52 падают](#13-проблема-p2-test-e2e-тесты--5052-падают)
14. [Проблема P2-TEST2: Нет тестов для критических модулей](#14-проблема-p2-test2-нет-тестов-для-критических-модулей)
15. [Проблема P2-CODE3: require() в ESM-модуле](#15-проблема-p2-code3-require-в-esm-модуле)
16. [Сводный план реализации](#16-сводный-план-реализации)
17. [Критерии приёмки](#17-критерии-приёмки)
18. [Риски и митигации](#18-риски-и-митигации)
19. [Связанные документы](#19-связанные-документы)

---

## 1. Резюме

По результатам полного аудита проекта (CODE_REVIEW v5.1, 42 выявленных проблемы), выделены **15 наиважнейших недостатков**, сгруппированных по приоритету:

| Приоритет | Количество проблем | Категория | Оценка сроков |
|-----------|-------------------|-----------|---------------|
| **P0 — Критические (Security)** | 2 | Безопасность | 3–4 дня |
| **P1 — Высокие (Архитектура)** | 8 | Декомпозиция, баги | 12–18 дней |
| **P2 — Средние (Тестирование/Код)** | 5 | Тесты, качество | 7–10 дней |
| **Итого** | **15** | | **22–32 дня** |

**Ключевой принцип:** Каждая проблема описана с точным указанием файлов, конкретным планом изменений, критериями приёмки и оценкой рисков.

---

## 2. Критерии отбора

Проблема включена в данное ТЗ, если выполняется **хотя бы одно** условие:

1. **Security** — утечка данных, несанкционированный доступ
2. **Баг** — некорректное поведение при штатных операциях (stale closures)
3. **Блокер развития** — файл невозможно развивать без декомпозиции (>800 строк)
4. **Нет тестов** — критический модуль без какого-либо покрытия

Исключены из ТЗ:
- Низкоприоритетные замечания (N-1, N-2)
- Документация (P4 — завершена)
- Бэклог (PWA, i18n, Swagger — будущие фичи)
- Исправленные проблемы (W-7 console.*, W-10 ARCHITECTURE.md)

---

## 3. Проблема P0-SEC: Утечка API-ключей в клиентский бандл

### 3.1 Описание

**Серьёзность:** 🔴 Критическая  
**С какого срока:** С v1.0  
**Файлы:**  
- `src/api/prices/geminiPriceSearch.ts`  
- `src/api/prices/mistralPriceSearch.ts`

`VITE_GEMINI_API_KEY` и `VITE_MISTRAL_API_KEY` встраиваются Vite в клиентский JS-бандл как plaintext-константы. Любой пользователь может извлечь их через DevTools → Sources.

### 3.2 Текущее состояние

```typescript
// src/api/prices/geminiPriceSearch.ts (строка ~15)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
// ↑ Становится const apiKey = "AIzaSy..." в бандле
```

### 3.3 Целевое состояние

AI-вызовы выполняются **только на сервере**. Клиент обращается к серверному прокси-эндпоинту.

```
Клиент:  POST /api/prices/search  { query, city }
                         ↓
Сервер:  geminiProvider.chat() / mistralProvider.chat()
                         ↓
Сервер:  API-ключ из process.env (не попадает в бандл)
                         ↓
Клиент:  получает результат
```

### 3.4 План изменений

#### 3.4.1 Серверный эндпоинт (2 часа)

Создать `server/src/routes/prices.ts`:

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { geminiProvider } from '../services/ai/geminiProvider.js';
import { mistralProvider } from '../services/ai/mistralProvider.js';
import { aiCache } from '../services/ai/aiCache.js';
import { winstonLogger } from '../middleware/logger.js';

const router = Router();

// POST /api/prices/search
router.post('/search', authMiddleware, async (req, res) => {
  const { query, city, provider } = req.body;
  
  // 1. Проверить кэш
  const cacheKey = `price:${query}:${city || 'default'}`;
  const cached = await aiCache.get(cacheKey);
  if (cached) {
    return res.json({ status: 'success', data: cached, fromCache: true });
  }

  // 2. Вызвать AI-провайдер
  try {
    const result = provider === 'mistral'
      ? await mistralProvider.searchPrices(query, city)
      : await geminiProvider.searchPrices(query, city);

    await aiCache.set(cacheKey, result, { ttl: 3600 }); // 1 час
    res.json({ status: 'success', data: result, fromCache: false });
  } catch (error) {
    winstonLogger.error('[POST /prices/search] AI error', { error });
    res.status(500).json({ status: 'error', message: 'AI search failed' });
  }
});

export default router;
```

#### 3.4.2 Регистрация роута (30 мин)

В `server/src/routes/index.ts` добавить:

```typescript
import pricesRoutes from './prices.js';
// ...
router.use('/prices', pricesRoutes);
```

#### 3.4.3 Клиентский рефакторинг (2 часа)

Заменить прямые AI-вызовы на серверные:

```typescript
// src/api/prices/geminiPriceSearch.ts — ПОЛНОСТЬЮ переписать
import { httpClient } from '../httpClient';
import type { PriceSearchResult } from './types';

export async function searchPrices(
  query: string,
  city?: string
): Promise<PriceSearchResult[]> {
  const response = await httpClient.post('/api/prices/search', {
    query,
    city,
    provider: 'gemini',
  });
  return response.data;
}
```

Аналогично для `mistralPriceSearch.ts`.

#### 3.4.4 Удаление VITE_* ключей (30 мин)

- Удалить `VITE_GEMINI_API_KEY` и `VITE_MISTRAL_API_KEY` из `.env.example` (клиент)
- Добавить `GEMINI_API_KEY` и `MISTRAL_API_KEY` в `server/.env.example` (без префикса `VITE_`)
- Обновить `server/src/config/env.ts` для чтения этих переменных

### 3.5 Критерии приёмки

- [ ] В клиентском бандле (`dist/assets/*.js`) нет строк `AIzaSy...` или аналогичных ключей
- [ ] `grep -r "VITE_GEMINI_API_KEY" src/` возвращает 0 результатов
- [ ] Поиск цен через UI работает (маршрут через сервер)
- [ ] Сервер логирует AI-запросы с userId

### 3.6 Оценка: 1 день

---

## 4. Проблема P0-SEC2: 19 admin-эндпоинтов без проверки прав

### 4.1 Описание

**Серьёзность:** 🔴 Критическая  
**Файл:** `server/src/routes/update.ts`  
**С какого срока:** С v4.0

19 маршрутов в `update.ts` содержат `// TODO: Проверить права администратора`. Любой авторизованный пользователь может:
- Запускать/останавливать задачи обновления цен
- Управлять парсерами
- Просматривать логи обновлений
- Модифицировать каталоги цен

### 4.2 План изменений

#### 4.2.1 Admin middleware (1 час)

Создать `server/src/middleware/adminAuth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { winstonLogger } from './logger.js';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  
  if (!user) {
    winstonLogger.warn('[ADMIN] Unauthorized access attempt', { path: req.path });
    res.status(401).json({ status: 'error', message: 'Authentication required' });
    return;
  }

  if (!user.is_admin) {
    winstonLogger.warn('[ADMIN] Non-admin access attempt', { 
      userId: user.id, email: user.email, path: req.path 
    });
    res.status(403).json({ status: 'error', message: 'Admin access required' });
    return;
  }

  next();
}
```

#### 4.2.2 Добавить is_admin в таблицу users (1 час)

Миграция `server/src/db/migrations/20260410_add_admin_flag.ts`:

```typescript
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.boolean('is_admin').defaultTo(false).after('is_premium');
  });
  
  // Назначить первого пользователя администратором
  await knex('users').update({ is_admin: true }).whereRaw(
    'id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)'
  );
}
```

#### 4.2.3 Обернуть admin-маршруты (1 час)

В `server/src/routes/update.ts`:

```typescript
import { adminAuth } from '../middleware/adminAuth.js';

// Все admin-маршруты обернуть в adminAuth
router.post('/start', authMiddleware, adminAuth, async (req, res) => { ... });
router.post('/stop', authMiddleware, adminAuth, async (req, res) => { ... });
router.post('/parsers/:name/run', authMiddleware, adminAuth, async (req, res) => { ... });
// ... и т.д. для всех 19 эндпоинтов
```

### 4.3 Критерии приёмки

- [ ] Авторизованный не-admin пользователь получает 403 на `/api/update/start`
- [ ] Admin-пользователь успешно выполняет admin-операции
- [ ] Попытки несанкционированного доступа логируются с userId

### 4.4 Оценка: 0.5 дня (зависит от P1-ARCH3 — декомпозиция update.ts)

> **Важно:** Целесообразно реализовать **после** декомпозиции `update.ts` (P1-ARCH3), когда структура маршрутов станет прозрачной.

---

## 5. Проблема P1-ARCH: God Module — ProjectContext (982 строки)

### 5.1 Описание

**Серьёзность:** 🔴 Высокая (блокер развития)  
**Файл:** `src/contexts/ProjectContext.tsx` — 982 строки  
**С какого срока:** С v3.0, стагнирует  
**Тренд:** 660 → 933 → 982 строки (растёт)

Контекст объединяет **7+ ответственностей**:

| # | Ответственность | Примеры функций | Оценка строк |
|---|----------------|-----------------|-------------|
| 1 | State management | `projects`, `activeProjectId`, `setActiveProjectId` | ~150 |
| 2 | Persistence (localStorage) | `scheduleSave`, `saveTimeoutRef`, `StorageManager` | ~200 |
| 3 | Server sync | `saveProjectsAsync`, `getApiProvider`, `isSyncing` | ~150 |
| 4 | Object CRUD | `createObject`, `updateObject`, `deleteObject`, `copyObject` | ~120 |
| 5 | Room operations | `addRoom`, `deleteRoom`, `reorderRooms`, `updateRoom` | ~100 |
| 6 | ID mapping & migration | `idMapper`, `migrateProjects` | ~100 |
| 7 | Utility (totals, loading) | `isLoading`, `isSyncing`, `lastSaved` | ~100 |

### 5.2 Целевая структура

```
src/contexts/
├── ProjectContext.tsx          # Тонкий фасад — только объединение хуков (<100 строк)
├── project/
│   ├── useProjectState.ts     # Чистый state: projects[], activeProjectId, activeObjectId (~180 строк)
│   ├── useProjectSync.ts      # Persistence + server sync: scheduleSave, saveQueue (~250 строк)
│   ├── useObjectManagement.ts # CRUD объектов: create, update, delete, copy (~150 строк)
│   ├── useRoomOperations.ts   # CRUD комнат: add, delete, reorder, update (~120 строк)
│   └── types.ts               # Общие типы для хуков (~30 строк)
```

### 5.3 План декомпозиции

#### Шаг 1: Создать `useProjectState.ts` (2 часа)

Извлечь из ProjectContext:
- `projects`, `setProjects` state
- `activeProjectId`, `setActiveProjectId` state
- `activeObjectId`, `setActiveObjectId` state
- `isLoading`, `isSyncing` state
- `activeProject`, `activeObject` — useMemo
- `setActiveProjectId()`, `setActiveObjectId()` — useCallback с сохранением в StorageManager
- `updateProjects()`, `updateActiveProject()` — базовые сеттеры

```typescript
// src/contexts/project/useProjectState.ts
export function useProjectState() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string>('');
  const [activeObjectId, setActiveObjectIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null, 
    [projects, activeProjectId]
  );

  const activeObject = useMemo(() => 
    activeProject?.objects?.find(o => o.id === activeObjectId) || null,
    [activeProject, activeObjectId]
  );

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    setActiveObjectIdState(''); // Сброс при переключении проекта
    StorageManager.saveActiveProject(id);
  }, []);

  const setActiveObjectId = useCallback((id: string) => {
    setActiveObjectIdState(id);
    StorageManager.saveActiveObject(id);
  }, []);

  return {
    projects, setProjects,
    activeProjectId, setActiveProjectId,
    activeObjectId, setActiveObjectId,
    activeProject, activeObject,
    isLoading, setIsLoading,
    isSyncing, setIsSyncing,
  };
}
```

#### Шаг 2: Создать `useProjectSync.ts` (3 часа)

Извлечь:
- `scheduleSave()`, `saveTimeoutRef`, `pendingSaveRef`
- `loadProjectsAsync()` — загрузка из localStorage + сервера
- `saveProjectsAsync()` — синхронизация с сервером
- `getApiProvider()` — ленивая инициализация
- `lastSaved`, `lastSavedToServer` state
- `beforeunload` handler
- Инкрементальное сохранение (сравнение JSON)

#### Шаг 3: Создать `useObjectManagement.ts` (2 часа)

Извлечь:
- `createObject()` — с генерацией ID через `generateId('obj')`
- `updateObject()`
- `deleteObject()`
- `copyObject()`

#### Шаг 4: Создать `useRoomOperations.ts` (2 часа)

Извлечь:
- `addRoom()` — **исправить stale closure** (см. P1-ARCH2)
- `deleteRoom()` — **исправить stale closure**
- `reorderRooms()` — **исправить stale closure**
- `updateRoom()`, `updateRoomById()`

#### Шаг 5: Переписать `ProjectContext.tsx` как фасад (1 час)

```typescript
// src/contexts/ProjectContext.tsx — ФАСАД
export function ProjectProvider({ children }: { children: ReactNode }) {
  const state = useProjectState();
  const sync = useProjectSync(state);
  const objects = useObjectManagement(state, sync);
  const rooms = useRoomOperations(state, sync);

  const value = useMemo(() => ({
    ...state,
    ...sync,
    ...objects,
    ...rooms,
  }), [state, sync, objects, rooms]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
```

### 5.4 Критерии приёмки

- [ ] `ProjectContext.tsx` ≤ 100 строк
- [ ] Каждый хук ≤ 300 строк
- [ ] Все существующие тесты проходят без изменений
- [ ] `tsc --noEmit` — 0 ошибок
- [ ] Поведение автосохранения идентично текущему

### 5.5 Оценка: 3 дня

### 5.6 Риски

| Риск | Вероятность | Митигация |
|------|------------|-----------|
| Разрыв зависимостей между хуками | Средняя | Чёткая передача state/sync через параметры |
| Регрессия автосохранения | Средняя | E2E-тест на сохранение перед/после |
| Сложность отладки контекста | Низкая | React DevTools показывает вложенные хуки |

---

## 6. Проблема P1-ARCH2: Stale closures в deleteRoom/addRoom/reorderRooms

### 6.1 Описание

**Серьёзность:** 🟡 Средняя (потенциальный баг)  
**Файл:** `src/contexts/ProjectContext.tsx`  
**С какого срока:** С v3.0, без изменений

При быстрых последовательных вызовах `deleteRoom`, `addRoom`, `reorderRooms` могут использоваться устаревшие данные из замыкания:

```typescript
// ТЕКУЩИЙ КОД (баг)
const deleteRoom = useCallback((roomId: string) => {
  if (!activeProject) return;       // ← stale closure: activeProject из предыдущего рендера
  const updatedProject = deleteRoomFromProject(activeProject, roomId);
  updateActiveProject(updatedProject);
}, [activeProject, updateActiveProject]);  // ← зависит от activeProject
```

**Проблема:** Если пользователь быстро удалит 2 комнаты, второй вызов `deleteRoom` увидит `activeProject` **до** первого удаления.

### 6.2 Решение

Перевести на `setProjects(prev => ...)` — functional updates, которые всегда работают с актуальным state:

```typescript
// ИСПРАВЛЕННЫЙ КОД
const deleteRoom = useCallback((roomId: string) => {
  setProjects(prev => {
    const project = prev.find(p => p.id === activeProjectId);
    if (!project) return prev;
    
    const updatedProject = deleteRoomFromProject(project, roomId);
    return prev.map(p => p.id === activeProjectId ? updatedProject : p);
  });
  // scheduleSave вызовется через эффект
}, [activeProjectId]);  // ← больше не зависит от activeProject
```

Аналогично для `addRoom` и `reorderRooms`.

### 6.3 План изменений (в рамках P1-ARCH, Шаг 4)

1. В `useRoomOperations.ts` — использовать `setProjects(prev => ...)` во всех трёх функциях
2. Добавить юнит-тест на быстрое последовательное удаление:
   ```typescript
   test('rapid deleteRoom calls preserve all deletions', () => {
     // Удалить 2 комнаты подряд без ожидания ре-рендера
     act(() => { rooms.deleteRoom(room1Id); rooms.deleteRoom(room2Id); });
     expect(activeProject.rooms).toHaveLength(initialCount - 2);
   });
   ```

### 6.4 Критерии приёмки

- [ ] `deleteRoom`, `addRoom`, `reorderRooms` не зависят от `activeProject` в deps
- [ ] Тест на быстрое последовательное удаление проходит
- [ ] E2E-сценарий: удаление 3 комнат подряд работает корректно

### 6.5 Оценка: 0.5 дня (включено в P1-ARCH)

---

## 7. Проблема P1-ARCH3: God File — routes/update.ts (2184 строки)

### 7.1 Описание

**Серьёзность:** 🔴 Высокая  
**Файл:** `server/src/routes/update.ts` — **2184 строки** — крупнейший файл проекта  
**С какого срока:** С v4.0

Маршруты + бизнес-логика + валидация + маппинг данных — всё в одном файле. 19 TODO-комментариев о проверке прав.

### 7.2 Целевая структура

```
server/src/
├── routes/
│   └── update.ts                    # Тонкие маршруты — только роутинг (~100 строк)
├── controllers/
│   └── updateController.ts          # Обработка запросов (~300 строк)
├── services/update/
│   ├── runner.ts                    # Оркестрация (существует, 647 строк)
│   ├── parserManager.ts            # Менеджер парсеров (существует, 661 строк)
│   ├── parsers/                    # Парсеры (существуют)
│   └── updateService.ts            # Бизнес-логика обновлений (~200 строк)
```

### 7.3 План декомпозиции

#### Шаг 1: Создать `updateController.ts` (3 часа)

Извлечь из `update.ts` обработчики каждого маршрута:

```typescript
// server/src/controllers/updateController.ts
export class UpdateController {
  constructor(private updateService: UpdateService) {}

  async startUpdate(req: AuthRequest, res: Response) { ... }
  async stopUpdate(req: AuthRequest, res: Response) { ... }
  async getStatus(req: AuthRequest, res: Response) { ... }
  async runParser(req: AuthRequest, res: Response) { ... }
  // ... 15 методов
}
```

#### Шаг 2: Создать `updateService.ts` (2 часа)

Извлечь бизнес-логику:
- Валидацию входных данных
- Вызов `runner.ts` / `parserManager.ts`
- Форматирование ответов
- Обработку ошибок

#### Шаг 3: Переписать `routes/update.ts` (1 час)

Только маршрутизация:

```typescript
// server/src/routes/update.ts
import { adminAuth } from '../middleware/adminAuth.js';
import { UpdateController } from '../controllers/updateController.js';

const controller = new UpdateController(updateService);

router.post('/start', authMiddleware, adminAuth, controller.startUpdate);
router.post('/stop', authMiddleware, adminAuth, controller.stopUpdate);
router.get('/status', authMiddleware, controller.getStatus);
// ...
```

### 7.4 Критерии приёмки

- [ ] `routes/update.ts` ≤ 100 строк
- [ ] `updateController.ts` ≤ 350 строк
- [ ] Все 19 TODO о правах заменены на `adminAuth` middleware
- [ ] Серверные тесты проходят

### 7.5 Оценка: 2 дня

---

## 8. Проблема P1-ARCH4: God Module — ApiStorageProvider (1036 строк)

### 8.1 Описание

**Серьёзность:** 🔴 Высокая  
**Файл:** `src/api/storage/apiStorageProvider.ts` — 1036 строк  
**С какого срока:** С v4.0, растёт (933 → 1036)

Singleton с множественными ответственностями: CRUD проектов/объектов/комнат, rate limiting, retry logic, sync, ID mapping.

### 8.2 Целевая структура

```
src/api/storage/
├── index.ts                    # Публичный экспорт (<50 строк)
├── apiStorageProvider.ts       # Фасад — делегирует модулям (<150 строк)
├── apiClient.ts                # HTTP-обёртка (retry, timeout, interceptors) (~200 строк)
├── projectApi.ts               # CRUD проектов (~200 строк)
├── objectApi.ts                # CRUD объектов (~150 строк)
├── roomApi.ts                  # CRUD комнат (~150 строк)
├── syncApi.ts                  # Синхронизация (push/pull) (~150 строк)
└── rateLimiter.ts              # Rate limiting + exponential backoff (~80 строк)
```

### 8.3 План декомпозиции

#### Шаг 1: `apiClient.ts` (3 часа)

Извлечь HTTP-логику:
- `fetchJson()` / `fetchWithAuth()`
- Retry с exponential backoff
- AbortController timeout
- Обработка 401 → refresh → retry

#### Шаг 2: `projectApi.ts` (2 часа)

Извлечь CRUD проектов:
- `saveProjectsAsync()`, `loadProjectsAsync()`
- `createProjectAsync()`, `deleteProjectAsync()`

#### Шаг 3: `objectApi.ts` + `roomApi.ts` (3 часа)

Извлечь CRUD объектов и комнат.

#### Шаг 4: `syncApi.ts` (2 часа)

Извлечь синхронизацию:
- `pushChanges()`, `pullChanges()`
- `syncObjects()`

#### Шаг 5: Переписать `apiStorageProvider.ts` как фасад (1 час)

### 8.4 Критерии приёмки

- [ ] `apiStorageProvider.ts` ≤ 150 строк (фасад)
- [ ] Каждый модуль ≤ 250 строк
- [ ] Все тесты `apiStorageProvider.test.ts` проходят
- [ ] Поведение retry/timeout идентично текущему

### 8.5 Оценка: 3 дня

---

## 9. Проблема P1-ARCH5: God Component — RoomEditor (902 строки)

### 9.1 Описание

**Серьёзность:** 🔴 Высокая  
**Файл:** `src/components/RoomEditor.tsx` — 902 строки  
**С какого срока:** С v3.0

Компонент содержит: геометрию, работы, материалы, обработчики, состояние формы.

### 9.2 Целевая структура

```
src/components/
├── RoomEditor.tsx               # Тонкий контейнер (<200 строк)
├── room/
│   ├── useRoomHandlers.ts       # Обработчики изменений (~200 строк)
│   ├── RoomGeometry.tsx         # Секция геометрии (~150 строк)
│   ├── RoomWorks.tsx            # Секция работ (~200 строк)
│   └── RoomHeader.tsx           # Заголовок комнаты (~80 строк)
```

### 9.3 План декомпозиции

#### Шаг 1: `useRoomHandlers.ts` (3 часа)

Извлечь все `handleXxx` функции:
- `handleNameChange`, `handleDimensionChange`
- `handleAddWork`, `handleDeleteWork`, `handleToggleWork`
- `handleGeometryModeChange`
- и т.д.

#### Шаг 2: UI-секции (3 часа)

Разделить JSX на подкомпоненты:
- `RoomHeader` — название + кнопки
- `RoomGeometry` — GeometrySection + ModeSelector
- `RoomWorks` — WorkList + WorkCatalogPicker

#### Шаг 3: Переписать RoomEditor как контейнер (1 час)

```typescript
// src/components/RoomEditor.tsx
export function RoomEditor({ room, onUpdate, onDelete }: RoomEditorProps) {
  const handlers = useRoomHandlers(room, onUpdate);
  
  return (
    <div className="room-editor">
      <RoomHeader room={room} handlers={handlers} onDelete={onDelete} />
      <RoomGeometry room={room} handlers={handlers} />
      <RoomWorks room={room} handlers={handlers} />
    </div>
  );
}
```

### 9.4 Критерии приёмки

- [ ] `RoomEditor.tsx` ≤ 200 строк
- [ ] Каждый подкомпонент ≤ 250 строк
- [ ] E2E-тест `room-input.spec.ts` проходит

### 9.5 Оценка: 2 дня

---

## 10. Проблема P1-ARCH6: God Component — BackupManager (837 строк)

### 10.1 Описание

**Серьёзность:** 🟡 Средняя  
**Файл:** `src/components/BackupManager.tsx` — 837 строк  
**С какого срока:** С v4.0

Export + Import + Sync + DataManagement — всё в одном компоненте.

### 10.2 Целевая структура

```
src/components/backup/
├── BackupManager.tsx            # Контейнер с табами (<100 строк)
├── ExportPanel.tsx              # Экспорт JSON/CSV (~200 строк)
├── ImportPanel.tsx              # Импорт JSON + валидация (~200 строк)
├── SyncPanel.tsx                # Синхронизация с сервером (~200 строк)
└── useBackupHandlers.ts         # Обработчики (~150 строк)
```

### 10.3 План декомпозиции

1. Извлечь `useBackupHandlers.ts` — все функции экспорта/импорта/синхронизации
2. Разделить UI на 3 панели по табам
3. `BackupManager.tsx` — только табы + выбор панели

### 10.4 Критерии приёмки

- [ ] `BackupManager.tsx` ≤ 100 строк
- [ ] Каждая панель ≤ 250 строк
- [ ] Экспорт/импорт JSON работает идентично текущему

### 10.5 Оценка: 2 дня

---

## 11. Проблема P1-CODE: Дублирование генерации ID (4+ способов)

### 11.1 Описание

**Серьёзность:** 🟡 Средняя  
**С какого срока:** С v3.0

4+ разных способа генерации ID в проекте:

| Файл | Код | Проблема |
|------|-----|----------|
| `ProjectContext.tsx` | `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0,8)}` | Нестабильный формат |
| `projectObjects.ts` | `local-obj-${Date.now()}-${Math.random().toString(36).slice(2,8)}` | Math.random — не криптографический |
| `App.tsx` | `local-${Date.now()}` | Коллизия при быстром создании |
| `RoomEditor.tsx` | `Math.random().toString(36).slice(2,11)` | Неуникальный |

### 11.2 Решение

Единая утилита `generateId(prefix)` в `utils/factories.ts`:

```typescript
// src/utils/factories.ts
export function generateId(prefix: string): string {
  // Формат: {prefix}-{timestamp}-{random8chars}
  // UUID-подобная уникальность, но с человекочитаемым префиксом
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().slice(0, 8);
  return `${prefix}-${timestamp}-${random}`;
}

// Специализированные фабрики
export const createRoomId = () => generateId('room');
export const createWorkId = () => generateId('work');
export const createObjectId = () => generateId('obj');
export const createMaterialId = () => generateId('mat');
export const createToolId = () => generateId('tool');
export const createOpeningId = () => generateId('opn');
export const createProjectId = () => generateId('proj');
```

### 11.3 План изменений

1. Обновить `factories.ts` — добавить `generateId()` и спец. фабрики
2. Заменить все 4+ способа генерации ID на вызовы `factories.ts`
3. Обновить тесты `projectObjects.test.ts`, `idMapper.test.ts`

### 11.4 Критерии приёмки

- [ ] `grep -r "Date.now()" src/ --include="*.ts" --include="*.tsx"` — 0 результатов в коде генерации ID
- [ ] `grep -r "Math.random" src/ --include="*.ts" --include="*.tsx"` — 0 результатов в коде генерации ID
- [ ] Все тесты проходят

### 11.5 Оценка: 0.5 дня

---

## 12. Проблема P1-CODE2: Magic strings для localStorage keys

### 12.1 Описание

**Серьёзность:** 🟡 Низкая  
**Файл:** `src/contexts/ProjectContext.tsx` (строка 729 и др.)

```typescript
localStorage.removeItem('repair-calc-active-project');  // magic string
```

Проект определяет `STORAGE_KEYS` в `utils/storage.ts`, но не везде использует.

### 12.2 Решение

1. Аудит всех localStorage-вызовов в `src/`
2. Заменить все magic strings на `STORAGE_KEYS.xxx`
3. Добавить недостающие ключи в `STORAGE_KEYS`

```typescript
// src/utils/storage.ts — расширить
export const STORAGE_KEYS = {
  PROJECTS: 'repair-calc-projects',
  ACTIVE_PROJECT: 'repair-calc-active-project',
  ACTIVE_OBJECT: 'repair-calc-active-object',
  TEMPLATES: 'repair-calc-templates',
  ID_MAPPINGS: 'repair-calc-id-mappings',
  SAVE_QUEUE: 'repair-calc-save-queue',
  E2E_TEST_MODE: 'e2e-test-mode',
  TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
} as const;
```

### 12.3 Критерии приёмки

- [ ] `grep -r "repair-calc" src/ --include="*.ts" --include="*.tsx" | grep -v STORAGE_KEYS | grep -v "storage.ts"` — 0 результатов
- [ ] Все ключи определены через `STORAGE_KEYS`

### 12.4 Оценка: 0.5 дня

---

## 13. Проблема P2-TEST: E2E-тесты — 50/52 падают

### 13.1 Описание

**Серьёзность:** 🟡 Средняя  
**С какого срока:** С v4.0

Из 52 E2E-тестов стабильно проходят только 2 (auth + objects). Основные причины:
- Устаревшие текстовые селекторы (не совпадают с реальным UI)
- Auth-токены перезаписывают тестовые данные
- Нет API-моков в большинстве тестов

### 13.2 Текущий статус по файлам

| Файл | Тестов | Падают | Основная причина |
|------|--------|--------|------------------|
| `auth.spec.ts` | 3 | 0 ✅ | Работают |
| `objects.spec.ts` | 4 | 0 ✅ | Работают |
| `core-workflow.spec.ts` | 3 | 3 | Зависит от авторизации |
| `costs.spec.ts` | 3 | 3 | Зависит от seeded-данных |
| `export-import.spec.ts` | 6 | 6 | Auth-токены при localStorage.clear() |
| `geometry.spec.ts` | 4 | 3 | Текстовые селекторы |
| `projects.spec.ts` | 3 | 3 | Зависит от авторизации |
| `regressions.spec.ts` | 5 | 5 | Смешанные проблемы |
| `responsive.spec.ts` | 2 | 1 | CSS-классы в тестах |
| `room-input.spec.ts` | 3 | 3 | 0 data-testid |
| `rooms.spec.ts` | 5 | 5 | Текстовые селекторы |
| `work-templates.spec.ts` | 7 | 7 | Auth-токены |
| `works.spec.ts` | 4 | 4 | `.first()` на ambiguous селекторах |

### 13.3 План исправлений

#### Этап 1: Унифицировать фикстуры (1 день)

Все тесты должны использовать единый паттерн:

```typescript
// e2e/fixtures.ts — обновить
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // 1. Очистить localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    
    // 2. Установить тестовый режим
    await page.evaluate(() => {
      localStorage.setItem('e2e-test-mode', 'true');
    });
    
    // 3. Замокать API-ответы
    await page.route('**/api/**', async (route) => {
      // ... универсальные моки
    });
    
    await use(page);
  },
});
```

#### Этап 2: Обновить селекторы (1 день)

Для каждого падающего файла — заменить текстовые селекторы на `data-testid`:

```typescript
// ДО:
const btn = page.locator('button:has-text("Добавить комнату")');

// ПОСЛЕ:
const btn = page.getByTestId('add-room-btn');
```

При необходимости — добавить недостающие `data-testid` в компоненты.

#### Этап 3: Добавить API-моки (1 день)

Для тестов, зависящих от серверных данных:

```typescript
await page.route('**/api/sync/pull', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'success', data: mockProjectData }),
  });
});
```

#### Этап 4: Распропустить и прогнать (1 день)

1. Снять `test.skip` один за другим
2. Запустить полный сьют
3. Добиться >80% pass rate

### 13.4 Критерии приёмки

- [ ] ≥42 из 52 E2E-тестов проходят стабильно (≥80%)
- [ ] `npx playwright test --repeat-each=5 --project=chromium` — 0 flaky
- [ ] Нет `test.skip` в сьюте (кроме явных FIXME)

### 13.5 Оценка: 4 дня

---

## 14. Проблема P2-TEST2: Нет тестов для критических модулей

### 14.1 Описание

**Серьёзность:** 🟡 Средняя  
**С какого срока:** С v4.0

4 критических модуля без какого-либо тестового покрытия:

| Модуль | Строк | Важность | Риск |
|--------|-------|----------|------|
| `ProjectContext.tsx` | 982 | 🔴 Критический | Stale closures, sync bugs |
| `RoomEditor.tsx` | 902 | 🔴 Критический | UI-регрессии |
| `BackupManager.tsx` | 837 | 🟡 Важный | Потеря данных при импорте |
| `httpClient.ts` | 408 | 🔴 Критический | Retry, timeout, refresh |

### 14.2 План

> **Важно:** Тесты для ProjectContext, RoomEditor, BackupManager пишутся **после** их декомпозиции (P1-ARCH, P1-ARCH5, P1-ARCH6). Тестировать God-модули неэффективно.

#### После декомпозиции ProjectContext (P1-ARCH):

1. `useProjectState.test.ts` — тесты state management (~30 тестов)
2. `useProjectSync.test.ts` — тесты синхронизации (~25 тестов)
3. `useObjectManagement.test.ts` — тесты CRUD объектов (~20 тестов)
4. `useRoomOperations.test.ts` — тесты CRUD комнат + stale closures (~15 тестов)

#### После декомпозиции RoomEditor (P1-ARCH5):

5. `useRoomHandlers.test.ts` — тесты обработчиков (~20 тестов)

#### Независимо от декомпозиции:

6. `httpClient.test.ts` — тесты retry, timeout, refresh (~25 тестов)

```typescript
// tests/api/httpClient.test.ts — пример
describe('httpClient', () => {
  test('retries on 429 with exponential backoff', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({ ok: true, json: () => ({ data: 'test' }) });
    
    const result = await httpClient.get('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('refreshes token on 401 and retries', async () => { ... });
  test('aborts request after timeout', async () => { ... });
});
```

### 14.3 Критерии приёмки

- [ ] `useProjectState.test.ts` — ≥25 тестов, все проходят
- [ ] `useProjectSync.test.ts` — ≥20 тестов, все проходят
- [ ] `useRoomOperations.test.ts` — ≥10 тестов, включая stale closure тест
- [ ] `httpClient.test.ts` — ≥20 тестов, все проходят
- [ ] Общее количество тестов ≥900 (сейчас 841)

### 14.4 Оценка: 3 дня (после завершения P1-ARCH)

---

## 15. Проблема P2-CODE3: require() в ESM-модуле

### 15.1 Описание

**Серьёзность:** 🟡 Низкая  
**Файл:** `src/api/storage/apiStorageProvider.ts`

```typescript
const { LocalStorageProvider } = require('../../utils/localStorageProvider');
```

`require()` в ESM-модуле — не работает при `type: "module"` в package.json. Следует использовать динамический `import()`.

### 15.2 Решение

```typescript
// Заменить на ленивый import
let LocalStorageProvider: typeof import('../../utils/localStorageProvider').LocalStorageProvider;

async function getLocalStorageProvider() {
  if (!LocalStorageProvider) {
    const mod = await import('../../utils/localStorageProvider');
    LocalStorageProvider = mod.LocalStorageProvider;
  }
  return LocalStorageProvider;
}
```

Или, если `LocalStorageProvider` нужен синхронно — использовать статический import (он уже есть в проекте как fallback).

### 15.3 Критерии приёмки

- [ ] `grep -r "require(" src/ --include="*.ts" --include="*.tsx"` — 0 результатов
- [ ] `tsc --noEmit` — 0 ошибок

### 15.4 Оценка: 0.5 часа

---

## 16. Сводный план реализации

### 16.1 Диаграмма зависимостей

```
P0-SEC (API-ключи)        ← независимая, делать первой
P0-SEC2 (admin auth)      ← зависит от P1-ARCH3 (update.ts декомпозиция)
P1-ARCH (ProjectContext)   ← независимая, делать второй
  ├── P1-ARCH2 (stale closures) ← решается В РАМКАХ P1-ARCH
  └── P2-TEST2 (тесты контекста) ← зависит от P1-ARCH
P1-ARCH3 (update.ts)      ← независимая
  └── P0-SEC2 (admin auth) ← решается В РАМКАХ P1-ARCH3
P1-ARCH4 (ApiStorage)     ← независимая
P1-ARCH5 (RoomEditor)     ← независимая
  └── P2-TEST2 (тесты RoomEditor) ← зависит от P1-ARCH5
P1-ARCH6 (BackupManager)  ← независимая
P1-CODE (ID generation)   ← независимая
P1-CODE2 (magic strings)  ← независимая
P2-TEST (E2E)             ← зависит от P1-ARCH5 (data-testid в RoomEditor)
P2-CODE3 (require)        ← зависит от P1-ARCH4 (переписывается вместе)
```

### 16.2 Рекомендуемая последовательность (спринты)

#### Спринт 1: Security (3 дня)

| День | Задача | Результат |
|------|--------|-----------|
| 1 | P0-SEC: Серверный прокси для AI-поиска | API-ключи убраны из бандла |
| 2 | P0-SEC: Клиентский рефакторинг + тесты | Поиск цен через сервер |
| 3 | P1-CODE + P1-CODE2 + P2-CODE3 | Мелкие исправления кода |

**Контрольная точка:** `grep -r "VITE_GEMINI" src/` → 0; `grep -r "require(" src/` → 0; все ключи через `STORAGE_KEYS`.

#### Спринт 2: Декомпозиция ProjectContext (4 дня)

| День | Задача | Результат |
|------|--------|-----------|
| 1 | P1-ARCH Шаг 1: `useProjectState.ts` | State management выделен |
| 2 | P1-ARCH Шаг 2: `useProjectSync.ts` | Persistence/sync выделен |
| 3 | P1-ARCH Шаг 3-4: `useObjectManagement.ts` + `useRoomOperations.ts` | CRUD выделен + stale closures исправлены |
| 4 | P1-ARCH Шаг 5: Фасад + интеграционное тестирование | ProjectContext ≤ 100 строк |

**Контрольная точка:** `ProjectContext.tsx` ≤ 100 строк; автосохранение работает; все unit-тесты проходят.

#### Спринт 3: Декомпозиция Backend + ApiStorage (5 дней)

| День | Задача | Результат |
|------|--------|-----------|
| 1-2 | P1-ARCH3: Декомпозиция `update.ts` + admin auth | update.ts ≤ 100 строк + P0-SEC2 решена |
| 3-5 | P1-ARCH4: Декомпозиция `ApiStorageProvider` | apiStorageProvider.ts ≤ 150 строк |

**Контрольная точка:** `update.ts` ≤ 100; `apiStorageProvider.ts` ≤ 150; admin auth работает.

#### Спринт 4: Декомпозиция UI (4 дня)

| День | Задача | Результат |
|------|--------|-----------|
| 1-2 | P1-ARCH5: Декомпозиция `RoomEditor` | RoomEditor ≤ 200 строк |
| 3-4 | P1-ARCH6: Декомпозиция `BackupManager` | BackupManager ≤ 100 строк |

**Контрольная точка:** Все God-модули декомпозированы; E2E-тесты rooms/works могут быть обновлены.

#### Спринт 5: Тестирование (7 дней)

| День | Задача | Результат |
|------|--------|-----------|
| 1-2 | P2-TEST2: Тесты `useProjectState`, `useProjectSync` | ≥45 новых тестов |
| 3 | P2-TEST2: Тесты `useRoomOperations`, `httpClient` | ≥35 новых тестов |
| 4-7 | P2-TEST: Стабилизация E2E-тестов | ≥42/52 проходят стабильно |

**Контрольная точка:** ≥900 unit-тестов; ≥80% E2E pass rate.

### 16.3 Общая оценка

| Спринт | Срок | Проблемы | Ключевой результат |
|--------|------|----------|-------------------|
| 1 | 3 дня | P0-SEC, P1-CODE, P1-CODE2, P2-CODE3 | Безопасность + чистота кода |
| 2 | 4 дня | P1-ARCH, P1-ARCH2 | ProjectContext декомпозирован |
| 3 | 5 дней | P1-ARCH3, P0-SEC2, P1-ARCH4 | Backend + ApiStorage декомпозированы |
| 4 | 4 дня | P1-ARCH5, P1-ARCH6 | UI декомпозирован |
| 5 | 7 дней | P2-TEST, P2-TEST2 | Полное тестовое покрытие |
| **Итого** | **23 дня** | **15 проблем** | **Все наиважнейшие недостатки устранены** |

### 16.4 Метрики «до» и «после»

| Метрика | До | После | Целевое |
|---------|-----|-------|---------|
| API-ключей в бандле | 2 | 0 | 0 |
| Admin-эндпоинтов без auth | 19 | 0 | 0 |
| Файлов >800 строк | 5 | 0 | 0 |
| Файлов >500 строк (production) | 10 | 3 (data/catalog) | ≤3 |
| Stale closures | 3 | 0 | 0 |
| Способов генерации ID | 4+ | 1 | 1 |
| Magic strings localStorage | ~8 | 0 | 0 |
| E2E pass rate | ~4% (2/52) | >80% | >80% |
| Unit-тестов | 841 | ≥900 | ≥900 |
| Тестов критических модулей | 0 | ≥80 | ≥80 |
| `require()` в ESM | 1 | 0 | 0 |

---

## 17. Критерии приёмки

### 17.1 Обязательные (блокеры)

- [ ] В клиентском бандле нет API-ключей
- [ ] Admin-эндпоинты защищены middleware
- [ ] Нет файлов >800 строк в production-коде
- [ ] Stale closures исправлены (тест на быстрое удаление)
- [ ] Единый способ генерации ID
- [ ] E2E pass rate ≥80%
- [ ] `tsc --noEmit` — 0 ошибок
- [ ] `vitest` — 0 failing

### 17.2 Желательные

- [ ] Общее количество тестов ≥900
- [ ] `eslint` — 0 errors (сейчас 0)
- [ ] `eslint` warnings <30 (сейчас 47)
- [ ] Нет `require()` в клиентском коде

---

## 18. Риски и митигации

| Риск | Вероятность | Влияние | Митигация |
|------|------------|---------|-----------|
| Регрессия автосохранения при декомпозиции ProjectContext | Средняя | Высокое | E2E-тест перед/после; пошаговая декомпозиция |
| E2E-тесты зависят от UI-структуры | Высокое | Среднее | data-testid вместо текстовых селекторов |
| Сложность отладки распределённого контекста | Низкая | Среднее | React DevTools + логирование |
| Несовместимость Vitest с Node.js | Низкая | Высокое | Проверить Node.js ≥18 перед стартом |
| Декомпозиция update.ts ломает существующие API-клиенты | Низкая | Среднее | API-контракт не меняется, только внутренняя структура |

---

## 19. Связанные документы

| Документ | Описание |
|----------|----------|
| [CODE_REVIEW.md](../../docs/CODE_REVIEW.md) | Код-ревью v5.1 — источник 42 замечаний |
| [TODO.md](../../docs/TODO.md) | Текущий бэклог задач |
| [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | Архитектура проекта |
| [PROGRESS.md](../../docs/PROGRESS.md) | История прогресса |
| [TECHNICAL-SPECIFICATION.md](../../docs/TECHNICAL-SPECIFICATION.md) | ТЗ v1.1 — группировка объектов |
| [SPEC-001-SYSTEM.md](./SPEC-001-SYSTEM.md) | Полная системная спецификация |
| [SPEC-002-E2E-REPAIR.md](./SPEC-002-E2E-REPAIR.md) | Спецификация E2E-ремонта |
| [E2E_TEST_STATUS.md](../../docs/E2E_TEST_STATUS.md) | Статус E2E-тестов |
| [E2E_FIX_PROGRESS.md](../../docs/E2E_FIX_PROGRESS.md) | Прогресс исправления E2E |

---

**Конец документа**

**Версия:** 1.0  
**Дата:** 2025-07-09  
**Проблем описано:** 15  
**Оценка суммарная:** 23 рабочих дня  
