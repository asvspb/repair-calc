# Техническое задание: Управление объектами и устранение дублирования

**Статус:** ✅ Реализовано (MVP)
**Приоритет:** Высокий
**Связанные документы:** [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)

---

## Проблема

В текущей реализации при синхронизации между localStorage и сервером возможно дублирование объектов (проектов, комнат). Это приводит к:
- Дублированию данных в базе
- Путанице для пользователя
- Избыточному потреблению ресурсов хранилища
- Рассинхронизации между устройствами

## Анализ текущей реализации

### Существующие типы (определены, но не используются)

В `src/types/storage.ts` уже определены следующие интерфейсы, которые **не имеют реализации** в кодовой базе:

```typescript
// Определены в src/types/storage.ts, но НИГДЕ не используются:
interface IdMapping {
  localId: string;
  serverId: string;
  migratedAt: Date;
  deviceId?: string;
}

interface IdMappingStore {
  mappings: Record<string, IdMapping>;
  lastCleanup: Date;
}

interface ProjectStatus {
  id: string;
  name: string;
  status: 'synced' | 'local' | 'conflict';
  roomsCount: number;
  dataSize: number;
  lastSynced?: Date;
  duplicateOf?: string;
}

interface DuplicateInfo {
  originalId: string;
  duplicateId: string;
  similarity: number;
  createdAt: Date;
}
```

**Вывод:** Типы уже готовы — нужно реализовать только утилиты и компоненты.

### Места загрузки/сохранения данных

#### 1. ProjectContext.tsx — основной контекст управления проектами

**Файл:** `src/contexts/ProjectContext.tsx`

```typescript
interface ProjectContextValue {
  // State
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isLoading: boolean;
  error: StorageError | null;
  lastSaved: Date | null;
  saveError: string | null;

  // Actions
  setActiveProjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  updateRoom: (room: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  deleteRoom: (roomId: string) => void;
  addRoom: (room: RoomData) => void;
  reorderRooms: (rooms: RoomData[]) => void;
}
```

**Ключевые особенности:**
- Загрузка при монтировании: `loadData()` в `useEffect`
- Автосохранение с debounce (1 сек): `scheduleSave()`
- Защита от потери данных при закрытии страницы (`beforeunload`)
- Миграция данных при загрузке

#### 2. ApiStorageProvider.ts — провайдер хранилища через API

**Файл:** `src/api/storage/apiStorageProvider.ts`

```typescript
class ApiStorageProvider implements IStorageProvider {
  private projectsCache: Map<string, ProjectData> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 30000; // 30 секунд

  // Методы
  async saveProjectsAsync(projects: ProjectData[]): Promise<void>
  async loadProjectsAsync(): Promise<ProjectData[]>
  async createProjectAsync(data: { name: string; city?: string }): Promise<ProjectData>
  async updateProjectAsync(project: ProjectData): Promise<ProjectData>
  async deleteProjectAsync(projectId: string): Promise<void>
  async getProjectWithRoomsAsync(projectId: string): Promise<ProjectData | null>
}
```

**Ключевые особенности:**
- Кэширование проектов в `projectsCache: Map<string, ProjectData>`
- TTL кэша: 30 секунд
- Дублирование в localStorage как "бэкап"
- Singleton паттерн через `getInstance()`

#### 3. Серверная часть (API endpoints)

**Файлы:** `src/api/projects.ts`, `src/api/rooms.ts`

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/projects` | GET | Получение списка проектов |
| `/api/projects/:id` | GET | Получение проекта с комнатами |
| `/api/projects` | POST | Создание проекта |
| `/api/projects/:id` | PUT | Обновление проекта |
| `/api/projects/:id` | DELETE | Удаление проекта |
| `/api/projects/:id/rooms` | POST | Создание комнаты |
| `/api/rooms/:id` | PUT | Обновление комнаты |
| `/api/rooms/:id` | DELETE | Удаление комнаты |
| `/api/sync/pull` | GET | Синхронизация — получение всех проектов с комнатами |

#### 4. Преобразование данных

**Формат ID:**
- Локальные ID: `local-<timestamp>` (например, `local-1711123456789`)
- Серверные ID: UUID формат (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Проверка серверного ID:**
```typescript
private isServerId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
```

### Потенциальные источники дублирования

#### 1. Локальные ID vs серверные UUID

**Файл:** `src/api/storage/apiStorageProvider.ts:140-170`

```typescript
if (!isServerProject || !existsOnServer) {
  // Создаётся новый проект на сервере
  const newProject = await this.createProjectAsync({...});
  // Но проект со старым локальным ID остаётся в списке!
}
```

**Проблема:** При сохранении проекта с локальным ID (`local-1234567890`) создаётся новый проект на сервере с UUID, но старая версия остаётся в локальном списке. Это приводит к появлению двух проектов:
- `local-1711123456789` (локальный, не синхронизирован)
- `550e8400-e29b-41d4-a716-446655440000` (серверный, актуальный)

#### 2. Множественные источники данных

**Файл:** `src/contexts/ProjectContext.tsx:93-120`

```typescript
if (isAuthenticated) {
  const serverProjects = await apiProvider.loadProjectsAsync();
  if (serverProjects.length > 0) {
    setProjects(migratedProjects);
  } else {
    // Загрузка из localStorage если сервер пуст
    const localProjects = StorageManager.loadProjects();
  }
}
```

**Проблема:** Возможна рассинхронизация между localStorage и сервером при:
- Переключении между авторизованным/неавторизованным режимом
- Ошибках сети при синхронизации
- Одновременной работе с нескольких устройств

#### 3. Сохранение в оба хранилища

**Файл:** `src/api/storage/apiStorageProvider.ts:125`

```typescript
localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
```

**Проблема:** При каждой загрузке с сервера данные пишутся в localStorage, но при этом локальные данные могут уже там быть. Это создаёт избыточные данные и затрудняет определение актуальной версии.

#### 4. Отсутствие маппинга ID

**Текущее состояние:** Нет механизма сопоставления локальных ID с серверными UUID.

**Последствия:**
- Невозможно определить, что локальный проект уже был синхронизирован
- При каждой синхронизации создаются новые проекты на сервере
- Невозможность отслеживания истории миграций

#### 5. Проблема конкурентности (Race Conditions)

**Файл:** `src/contexts/ProjectContext.tsx` — `scheduleSave()`

**Проблема:** `saveProjectsAsync()` — асинхронная операция, но debounce в 1 сек не гарантирует завершение предыдущего сохранения перед началом следующего. При быстрых изменениях:

```
t=0.0s  Изменение A → scheduleSave()
t=0.3s  Изменение B → scheduleSave() (debounce сброшен)
t=1.0s  saveProjectsAsync(A) НАЧАТО
t=1.2s  saveProjectsAsync(A) всё ещё выполняется...
t=1.3s  Изменение C → scheduleSave()
t=2.0s  saveProjectsAsync(C) НАЧАТО (пока A ещё не завершено!)
t=2.1s  saveProjectsAsync(A) ЗАВЕРШЕНО — данные перезаписаны версией C
```

**Последствия:**
- Потеря данных (последнее сохранение перезаписывает предыдущее)
- Дублирование при параллельных `createProjectAsync` вызовах
- Неконсистентное состояние кэша

#### 6. Отсутствие восстановления после ошибок

**Проблема:** В `saveProjectsAsync` при ошибке создания проекта:
- Ошибка логируется в консоль
- Локальное состояние остаётся с локальным ID
- При следующем сохранении — повторная попытка без backoff или retry limit
- Нет механизма отката к последней известной хорошей версии

#### 7. Маппинг ID только на уровне проектов

**Проблема:** Спека описывает маппинг только для проектов. Комнаты (rooms) тоже получают новые UUID при создании на сервере, но их маппинг не отслеживается. Если в будущем появятся ссылки между комнатами или между комнатами и другими сущностями — это приведёт к битым ссылкам.

#### 8. Несогласованность протокола синхронизации

**Проблема:** Сервер имеет endpoint `POST /api/sync/push` (stub), ожидающий `ChangeLogEntry[]`, но клиент использует прямые CRUD-вызовы вместо протокола синхронизации через change log. Это создаёт путаницу и делает stub endpoint бесполезным.

#### 9. Стратегия offline-first не определена

**Проблема:** При отсутствии сети:
- Данные сохраняются в localStorage
- При восстановлении соединения — нет чёткого алгоритма слияния
- Нет очереди изменений для последовательного применения
- Нет индикатора offline-режима для пользователя

---

## Диаграмма потока данных

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Client   │────▶│ ApiStorageProvider│────▶│  REST API       │
│  (ProjectCtx)   │◀────│  (cache + sync)   │◀────│  (Express)      │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
         │                                                  │
         │                                                  ▼
         │                                         ┌─────────────────┐
         │                                         │   MySQL DB      │
         │                                         │   (projects)    │
         │                                         └─────────────────┘
         ▼
┌─────────────────┐
│  localStorage   │
│  (backup)       │
└─────────────────┘
```

**Поток при загрузке:**
1. `ProjectContext.loadData()` → `ApiStorageProvider.loadProjectsAsync()`
2. Проверка кэша (TTL 30 сек) → если актуален, возврат из кэша
3. Если кэш устарел → запрос к `/api/sync/pull`
4. Получение проектов → обновление кэша → сохранение в localStorage (бэкап)
5. Возврат в `ProjectContext`

**Поток при сохранении:**
1. Изменение в `ProjectContext` → `updateProjects()`
2. `scheduleSave()` с debounce (1 сек) → `ApiStorageProvider.saveProjectsAsync()`
3. Для каждого проекта:
   - Проверка: локальный ID или серверный
   - Проверка: существует ли на сервере
   - Если локальный → создание нового на сервере
   - Если серверный → обновление существующего
4. Сохранение в localStorage (бэкап)

## Предлагаемое решение

### Задача 1: Идентификация и сопоставление объектов

**Решение:** Ввести механизм сопоставления локальных ID с серверными UUID.

#### 1.1 Структура данных маппинга

```typescript
// src/types/storage.ts
interface IdMapping {
  localId: string;      // локальный ID (например, local-1711123456789)
  serverId: string;     // серверный UUID (например, 550e8400-e29b-41d4-a716-446655440000)
  migratedAt: Date;     // дата миграции
  deviceId?: string;    // ID устройства (для multi-device sync)
}

interface IdMappingStore {
  mappings: Record<string, IdMapping>;  // key = localId
  lastCleanup: Date;
}
```

#### 1.2 Хранилище маппингов

**Файл:** `src/utils/idMapper.ts` (новый)

```typescript
const MAPPING_KEY = 'repair-calc-id-mappings';

class IdMapper {
  private mappings: Map<string, IdMapping> = new Map();

  constructor() {
    this.load();
  }

  load(): void {
    const data = localStorage.getItem(MAPPING_KEY);
    if (data) {
      const store = JSON.parse(data) as IdMappingStore;
      this.mappings = new Map(Object.entries(store.mappings));
    }
  }

  save(): void {
    const store: IdMappingStore = {
      mappings: Object.fromEntries(this.mappings),
      lastCleanup: new Date(),
    };
    localStorage.setItem(MAPPING_KEY, JSON.stringify(store));
  }

  addMapping(localId: string, serverId: string): void {
    this.mappings.set(localId, {
      localId,
      serverId,
      migratedAt: new Date(),
      deviceId: this.getDeviceId(),
    });
    this.save();
  }

  getServerId(localId: string): string | null {
    return this.mappings.get(localId)?.serverId || null;
  }

  getLocalId(serverId: string): string | null {
    for (const mapping of this.mappings.values()) {
      if (mapping.serverId === serverId) {
        return mapping.localId;
      }
    }
    return null;
  }

  hasMapping(localId: string): boolean {
    return this.mappings.has(localId);
  }

  removeMapping(localId: string): void {
    this.mappings.delete(localId);
    this.save();
  }

  getAllMappings(): IdMapping[] {
    return Array.from(this.mappings.values());
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('device-id');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('device-id', deviceId);
    }
    return deviceId;
  }

  // Очистка старых маппингов (старше 90 дней)
  cleanup(oldDays: number = 90): number {
    const now = Date.now();
    const maxAge = oldDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const [localId, mapping] of this.mappings.entries()) {
      const age = now - new Date(mapping.migratedAt).getTime();
      if (age > maxAge) {
        this.mappings.delete(localId);
        removed++;
      }
    }

    if (removed > 0) {
      this.save();
    }
    return removed;
  }
}

export const idMapper = new IdMapper();
```

#### 1.3 Интеграция в ApiStorageProvider

**Изменения в `saveProjectsAsync`:**

```typescript
async saveProjectsAsync(projects: ProjectData[]): Promise<void> {
  const startTime = logStart('ApiStorage', 'Сохранение проектов', { count: projects.length });

  try {
    // Обновляем кэш немедленно для UI
    this.projectsCache.clear();
    projects.forEach(p => this.projectsCache.set(p.id, p));
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    // Сохраняем также в localStorage как бэкап
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));

    // Получаем список существующих ID проектов на сервере
    const existingProjects = await this.loadProjectsAsync();
    const existingProjectIds = new Set(existingProjects.map(p => p.id));

    // Синхронизируем каждый проект
    for (const project of projects) {
      const isServerProject = this.isServerId(project.id);
      const existsOnServer = existingProjectIds.has(project.id);

      if (!isServerProject && !existsOnServer) {
        // Локальный проект, которого нет на сервере — создаём
        const newProject = await this.createProjectAsync({
          name: project.name,
          city: project.city,
        });

        // !!! ДОБАВЛЯЕМ МАППИНГ !!!
        idMapper.addMapping(project.id, newProject.id);

        // Синхронизируем комнаты нового проекта
        for (const room of project.rooms) {
          await roomsApi.createRoom(newProject.id, room);
        }

        // !!! УДАЛЯЕМ локальный проект из списка !!!
        // Он будет заменён на серверный в следующем шаге
      } else if (isServerProject && existsOnServer) {
        // Серверный проект — обновляем
        await this.updateProjectAsync(project);

        // Синхронизируем комнаты
        const serverProject = existingProjects.find(p => p.id === project.id);
        const existingRoomIds = new Set(serverProject?.rooms.map(r => r.id) || []);

        for (const room of project.rooms) {
          const roomExistsOnServer = this.isServerId(room.id) && existingRoomIds.has(room.id);

          if (roomExistsOnServer) {
            await roomsApi.updateRoom(room.id, room);
          } else {
            await roomsApi.createRoom(project.id, room);
          }
        }
      }
    }

    // !!! ЗАМЕНЯЕМ локальные ID на серверные в списке проектов !!!
    const updatedProjects = await this.loadProjectsAsync();
    this.projectsCache.clear();
    updatedProjects.forEach(p => this.projectsCache.set(p.id, p));

    logSuccess('ApiStorage', 'Проекты успешно синхронизированы', { count: projects.length }, startTime);
  } catch (error) {
    logError('ApiStorage', 'Ошибка сохранения проектов', error);
    throw StorageProviderError.fromError(error);
  }
}
```

### Задача 2: Устранение дублирования при сохранении

**Решение:** Изменить логику `saveProjectsAsync` для предотвращения создания дубликатов.

#### 2.1 Алгоритм предотвращения дублирования

```typescript
async saveProjectsAsync(projects: ProjectData[]): Promise<void> {
  const existingProjects = await this.loadProjectsAsync();
  const existingIds = new Set(existingProjects.map(p => p.id));
  const projectsToRemove: string[] = [];

  for (const project of projects) {
    if (existingIds.has(project.id)) {
      // ОБНОВИТЬ существующий проект
      await this.updateProjectAsync(project);
    } else if (this.isServerId(project.id)) {
      // Серверный ID, но проекта нет — был удалён на другом устройстве
      // Пропустить или создать заново (в зависимости от политики)
      logDebug('ApiStorage', 'Проект не найден на сервере', { projectId: project.id });
    } else {
      // Локальный ID — мигрировать на сервер
      const serverId = idMapper.getServerId(project.id);
      
      if (serverId) {
        // Уже есть маппинг — используем существующий серверный проект
        const mappedProject = existingProjects.find(p => p.id === serverId);
        if (mappedProject) {
          await this.updateProjectAsync({ ...project, id: serverId });
          projectsToRemove.push(project.id); // Удалить локальный дубликат
        }
      } else {
        // Нет маппинга — создаём новый проект
        const newProject = await this.createProjectAsync({
          name: project.name,
          city: project.city,
        });
        idMapper.addMapping(project.id, newProject.id);
        projectsToRemove.push(project.id); // Удалить локальный после миграции
      }
    }
  }

  // Удаляем локальные дубликаты из списка
  const deduplicatedProjects = projects.filter(p => !projectsToRemove.includes(p.id));
  
  // Загружаем актуальный список с сервера
  const updatedProjects = await this.loadProjectsAsync();
  
  // Объединяем: серверные проекты + локальные (без дубликатов)
  const finalProjects = [...updatedProjects, ...deduplicatedProjects];
  
  // Обновляем кэш
  this.projectsCache.clear();
  finalProjects.forEach(p => this.projectsCache.set(p.id, p));
}
```

#### 2.2 Очистка localStorage

**Файл:** `src/utils/storageCleanup.ts` (новый)

```typescript
import { idMapper } from './idMapper';

/**
 * Очистка локальных дубликатов после успешной миграции
 */
export function cleanupLocalDuplicates(): void {
  const mappings = idMapper.getAllMappings();
  const projectsData = localStorage.getItem('repair-calc-projects');
  
  if (!projectsData) return;
  
  const projects = JSON.parse(projectsData) as ProjectData[];
  const localIdsToRemove = new Set(mappings.map(m => m.localId));
  
  // Фильтруем проекты, оставляя только те, что не были мигрированы
  const filteredProjects = projects.filter(p => !localIdsToRemove.has(p.id));
  
  if (filteredProjects.length !== projects.length) {
    localStorage.setItem('repair-calc-projects', JSON.stringify(filteredProjects));
    console.log(`[StorageCleanup] Удалено ${projects.length - filteredProjects.length} локальных дубликатов`);
  }
}

/**
 * Принудительная очистка всех маппингов и локальных данных
 */
export function forceCleanup(): void {
  localStorage.removeItem('repair-calc-id-mappings');
  idMapper.cleanup(0); // Очистить всё
}
```

### Задача 3: Устранение гонок при сохранении (Race Conditions)

**Решение:** Ввести очередь сохранений с последовательным выполнением.

#### 3.0 Модуль SaveQueue

**Файл:** `src/utils/saveQueue.ts` (новый)

```typescript
type SaveTask = () => Promise<void>;

class SaveQueue {
  private queue: SaveTask[] = [];
  private isProcessing = false;
  private latestTask: SaveTask | null = null;

  /**
   * Добавить задачу сохранения.
   * Если очередь уже обрабатывается — сохраняется только ПОСЛЕДНЯЯ задача (debounce на уровне очереди).
   */
  enqueue(task: SaveTask): void {
    // Вместо накопления всех задач — храним только последнюю
    this.latestTask = task;
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || !this.latestTask) return;

    this.isProcessing = true;
    const task = this.latestTask;
    this.latestTask = null;

    try {
      await task();
    } catch (error) {
      console.error('[SaveQueue] Ошибка сохранения:', error);
      // При ошибке — retry с exponential backoff (макс 3 попытки)
    } finally {
      this.isProcessing = false;
      // Если за время выполнения пришли новые изменения — запускаем снова
      if (this.latestTask) {
        this.processNext();
      }
    }
  }
}

export const saveQueue = new SaveQueue();
```

**Интеграция в ProjectContext:**

```typescript
// Вместо прямого вызова saveProjectsAsync:
const scheduleSave = useCallback(() => {
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }
  saveTimeoutRef.current = setTimeout(() => {
    saveQueue.enqueue(async () => {
      const currentProjects = projectsRef.current;
      await apiProvider.saveProjectsAsync(currentProjects);
    });
  }, 1000);
}, []);
```

**Гарантии:**
- Одновременно выполняется только одно сохранение
- Между сохранениями — всегда актуальная версия данных
- Нет потери данных из-за перезаписи

### Задача 3.1: Восстановление после ошибок

**Решение:** Добавить стратегию retry с exponential backoff и откат к последней известной хорошей версии.

#### Retry с backoff

```typescript
// src/utils/retry.ts (новый)

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) break;

      // Exponential backoff с jitter
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
        opts.maxDelayMs
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

#### Откат к последней известной версии

```typescript
// Интеграция в ApiStorageProvider

private lastGoodState: ProjectData[] | null = null;

async saveProjectsAsync(projects: ProjectData[]): Promise<void> {
  // Сохраняем "snapshot" перед попыткой
  const snapshot = JSON.parse(JSON.stringify(projects));

  try {
    // ... основная логика сохранения ...
    this.lastGoodState = snapshot; // Успех — обновляем snapshot
  } catch (error) {
    // Ошибка — можно откатить к lastGoodState
    console.error('[ApiStorage] Сохранение не удалось, данные НЕ потеряны (snapshot сохранён)');
    throw error;
  }
}

// Метод для принудительного отката
rollbackToLastGood(): ProjectData[] | null {
  return this.lastGoodState;
}
```

### Задача 3.2: Маппинг ID на уровне комнат

**Решение:** Расширить `IdMapper` для поддержки маппинга комнат.

```typescript
// Расширение IdMapper

interface RoomIdMapping {
  localRoomId: string;
  serverRoomId: string;
  projectId: string;  // к какому проекту относится
  migratedAt: Date;
}

class IdMapper {
  private projectMappings: Map<string, IdMapping> = new Map();
  private roomMappings: Map<string, RoomIdMapping> = new Map();

  addRoomMapping(localRoomId: string, serverRoomId: string, projectId: string): void {
    this.roomMappings.set(localRoomId, {
      localRoomId,
      serverRoomId,
      projectId,
      migratedAt: new Date(),
    });
    this.save();
  }

  getServerRoomId(localRoomId: string): string | null {
    return this.roomMappings.get(localRoomId)?.serverRoomId || null;
  }

  getRoomMappingsForProject(projectId: string): RoomIdMapping[] {
    return Array.from(this.roomMappings.values())
      .filter(m => m.projectId === projectId);
  }
}
```

**Интеграция в `saveProjectsAsync`** (при создании комнаты):

```typescript
for (const room of project.rooms) {
  const existingRoomId = idMapper.getServerRoomId(room.id);
  if (existingRoomId) {
    await roomsApi.updateRoom(existingRoomId, room);
  } else {
    const newRoom = await roomsApi.createRoom(project.id, room);
    idMapper.addRoomMapping(room.id, newRoom.id, project.id);
  }
}
```

### Задача 3.3: Интеграция с оптимистичной блокировкой

**Текущее состояние:** Сервер (`server/src/routes/projects.ts:73-75`) проверяет `version` при обновлении, но клиент не отправляет это поле корректно.

**Решение:** Гарантировать отправку `version` при обновлении и обрабатывать конфликты.

```typescript
// В ApiStorageProvider.updateProjectAsync
async updateProjectAsync(project: ProjectData): Promise<ProjectData> {
  try {
    const response = await projectsApi.updateProject(project.id, {
      name: project.name,
      city: project.city,
      version: project.version, // ОБЯЗАТЕЛЬНО передаём version
    });
    return projectsApi.apiToClientProject(response.data);
  } catch (error: any) {
    if (error.response?.status === 403 && error.response?.data?.message?.includes('Version conflict')) {
      // Конфликт версий — запрашиваем актуальную версию с сервера
      const latest = await this.getProjectWithRoomsAsync(project.id);
      if (latest) {
        // Стратегия: merge на основе полей
        const merged = mergeProjectVersions(project, latest);
        // Повторная попытка с merged-версией
        return this.updateProjectAsync(merged);
      }
    }
    throw error;
  }
}

function mergeProjectVersions(local: ProjectData, server: ProjectData): ProjectData {
  // Last-write-wins по каждому полю, rooms — объединение
  return {
    ...server,
    name: local.name || server.name,
    city: local.city || server.city,
    rooms: mergeRooms(local.rooms, server.rooms),
    version: server.version, // Берём серверную версию как базу
  };
}
```

### Задача 3.4: Offline-first стратегия

**Решение:** Очередь изменений для последовательного применения при восстановлении соединения.

#### Структура очереди изменений

```typescript
// src/types/sync.ts (новый)

interface PendingChange {
  id: string;                    // UUID изменения
  entityType: 'project' | 'room';
  entityId: string;              // ID сущности (локальный или серверный)
  action: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
  timestamp: number;             // Date.now()
  retryCount: number;
}

interface SyncQueue {
  changes: PendingChange[];
  lastSyncAttempt: number | null;
  lastSuccessfulSync: number | null;
}
```

#### Модуль SyncQueue

**Файл:** `src/utils/syncQueue.ts` (новый)

```typescript
const QUEUE_KEY = 'repair-calc-sync-queue';

class SyncQueueManager {
  private queue: PendingChange[] = [];

  load(): void {
    const data = localStorage.getItem(QUEUE_KEY);
    if (data) {
      this.queue = JSON.parse(data);
    }
  }

  add(change: Omit<PendingChange, 'id' | 'timestamp' | 'retryCount'>): void {
    this.queue.push({
      ...change,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    });
    this.save();
  }

  async flush(): Promise<{ success: number; failed: number }> {
    // Сортируем по timestamp (FIFO)
    const sorted = [...this.queue].sort((a, b) => a.timestamp - b.timestamp);
    let success = 0, failed = 0;

    for (const change of sorted) {
      try {
        await this.applyChange(change);
        this.remove(change.id);
        success++;
      } catch (error) {
        change.retryCount++;
        if (change.retryCount >= 5) {
          // Максимум 5 попыток — перемещаем в "dead letter"
          this.moveToDeadLetter(change);
        }
        failed++;
      }
    }

    this.save();
    return { success, failed };
  }

  private async applyChange(change: PendingChange): Promise<void> {
    switch (change.action) {
      case 'create':
        // ...
      case 'update':
        // ...
      case 'delete':
        // ...
    }
  }

  private remove(changeId: string): void {
    this.queue = this.queue.filter(c => c.id !== changeId);
  }

  private moveToDeadLetter(change: PendingChange): void {
    // Логируем для ручного разбора
    console.error('[SyncQueue] Не удалось синхронизировать:', change);
    this.remove(change.id);
  }

  private save(): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
  }

  get pendingCount(): number {
    return this.queue.length;
  }
}

export const syncQueue = new SyncQueueManager();
```

#### Индикатор offline-режима

```typescript
// В ProjectContext или отдельном хуке

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Автоматическая синхронизация при восстановлении соединения
      syncQueue.flush();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### Задача 3.5: Миграция для существующих пользователей

**Проблема:** У текущих пользователей уже могут быть дубликаты в localStorage и/или на сервере. Нужна одноразовая миграция.

**Решение:** Миграционный скрипт, запускаемый при первом входе после обновления.

#### Маркер версии миграции

```typescript
// src/utils/migration.ts (новый)

const MIGRATION_VERSION_KEY = 'repair-calc-migration-version';
const CURRENT_MIGRATION_VERSION = 1;

interface MigrationContext {
  idMapper: IdMapper;
  apiProvider: ApiStorageProvider;
}

async function runMigrations(context: MigrationContext): Promise<void> {
  const currentVersion = parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '0', 10);

  if (currentVersion >= CURRENT_MIGRATION_VERSION) return;

  console.log(`[Migration] Запуск миграций: v${currentVersion} → v${CURRENT_MIGRATION_VERSION}`);

  // Миграция v0 → v1: Обнаружение и маркировка дубликатов
  if (currentVersion < 1) {
    await migrateV0ToV1(context);
  }

  // Обновляем маркер
  localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_MIGRATION_VERSION));
  console.log('[Migration] Миграции завершены');
}

async function migrateV0ToV1({ idMapper, apiProvider }: MigrationContext): Promise<void> {
  // 1. Загружаем проекты из обоих источников
  const localProjects = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]'
  ) as ProjectData[];

  let serverProjects: ProjectData[] = [];
  try {
    serverProjects = await apiProvider.loadProjectsAsync();
  } catch (e) {
    console.warn('[Migration v1] Не удалось загрузить серверные проекты, пропускаем');
  }

  // 2. Ищем дубликаты по имени и количеству комнат
  const duplicates: Array<{ local: ProjectData; server: ProjectData; similarity: number }> = [];

  for (const local of localProjects) {
    if (isServerId(local.id)) continue; // Пропускаем уже синхронизированные

    for (const server of serverProjects) {
      const similarity = calculateSimilarity(local, server);
      if (similarity > 0.8) {
        duplicates.push({ local, server, similarity });
        idMapper.addMapping(local.id, server.id);
      }
    }
  }

  // 3. Удаляем дубликаты из localStorage
  if (duplicates.length > 0) {
    const duplicateLocalIds = new Set(duplicates.map(d => d.local.id));
    const cleaned = localProjects.filter(p => !duplicateLocalIds.has(p.id));
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(cleaned));
    console.log(`[Migration v1] Удалено ${duplicates.length} дубликатов`);
  }
}
```

**Точка вызова:** В `ProjectContext.loadData()`, перед загрузкой данных:

```typescript
// Внутри loadData()
if (isAuthenticated) {
  await runMigrations({ idMapper, apiProvider });
  // ... далее обычная загрузка
}
```

### Задача 4: Управление объектами (UI)

**Решение:** Создать компонент `ObjectManager.tsx` для просмотра и управления объектами.

#### 4.1 Компонент ObjectManager

**Файл:** `src/components/ObjectManager.tsx` (новый)

```typescript
interface ObjectManagerProps {
  onClose: () => void;
}

interface ProjectStatus {
  id: string;
  name: string;
  status: 'synced' | 'local' | 'conflict';
  roomsCount: number;
  dataSize: number;
  lastSynced?: Date;
  duplicateOf?: string; // ID оригинала, если это дубликат
}

export function ObjectManager({ onClose }: ObjectManagerProps) {
  const { projects } = useProjectContext();
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);

  useEffect(() => {
    analyzeProjects(projects).then(setStatuses);
  }, [projects]);

  const handleSync = async (localId: string) => {
    // Миграция локального проекта на сервер
  };

  const handleMerge = async (duplicateId: string, originalId: string) => {
    // Объединение дубликатов
  };

  const handleDelete = async (projectId: string) => {
    // Удаление проекта
  };

  return (
    <div className="object-manager">
      <h2>Управление объектами</h2>
      
      <table>
        <thead>
          <tr>
            <th>Проект</th>
            <th>Статус</th>
            <th>Комнаты</th>
            <th>Размер</th>
            <th>Синхронизация</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map(status => (
            <tr key={status.id}>
              <td>{status.name}</td>
              <td>
                {status.status === 'synced' && '✅ Синхронизирован'}
                {status.status === 'local' && '⚠️ Локальный'}
                {status.status === 'conflict' && '❌ Дубликат'}
              </td>
              <td>{status.roomsCount}</td>
              <td>{formatBytes(status.dataSize)}</td>
              <td>{status.lastSynced?.toLocaleString() || 'Никогда'}</td>
              <td>
                {status.status === 'local' && (
                  <button onClick={() => handleSync(status.id)}>
                    Синхронизировать
                  </button>
                )}
                {status.status === 'conflict' && (
                  <>
                    <button onClick={() => handleMerge(status.id, status.duplicateOf!)}>
                      Объединить
                    </button>
                    <button onClick={() => handleDelete(status.id)}>
                      Удалить
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button onClick={onClose}>Закрыть</button>
    </div>
  );
}
```

#### 4.2 Функция анализа проектов

**Файл:** `src/utils/objectAnalyzer.ts` (новый)

```typescript
import { idMapper } from './idMapper';
import type { ProjectData } from '../types';

export interface ProjectStatus {
  id: string;
  name: string;
  status: 'synced' | 'local' | 'conflict';
  roomsCount: number;
  dataSize: number;
  lastSynced?: Date;
  duplicateOf?: string;
  similarity?: number;
}

export async function analyzeProjects(projects: ProjectData[]): Promise<ProjectStatus[]> {
  const statuses: ProjectStatus[] = [];
  const serverIds = new Set<string>();
  const localIds = new Set<string>();

  // Собираем ID
  projects.forEach(p => {
    if (isServerId(p.id)) {
      serverIds.add(p.id);
    } else {
      localIds.add(p.id);
    }
  });

  // Анализируем каждый проект
  for (const project of projects) {
    const isServer = isServerId(project.id);
    const hasMapping = idMapper.hasMapping(project.id);
    const serverId = hasMapping ? idMapper.getServerId(project.id) : null;

    let status: ProjectStatus = {
      id: project.id,
      name: project.name,
      status: isServer ? 'synced' : 'local',
      roomsCount: project.rooms.length,
      dataSize: estimateProjectSize(project),
      lastSynced: undefined,
    };

    // Проверяем на дублирование
    if (!isServer && serverId && serverIds.has(serverId)) {
      const serverProject = projects.find(p => p.id === serverId);
      if (serverProject) {
        const similarity = calculateSimilarity(project, serverProject);
        if (similarity > 0.8) {
          status.status = 'conflict';
          status.duplicateOf = serverId;
          status.similarity = similarity;
        }
      }
    }

    statuses.push(status);
  }

  return statuses;
}

function isServerId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function estimateProjectSize(project: ProjectData): number {
  return new TextEncoder().encode(JSON.stringify(project)).length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function calculateSimilarity(a: ProjectData, b: ProjectData): number {
  // Простая эвристика: совпадение имени и количества комнат
  let score = 0;
  if (a.name === b.name) score += 0.5;
  if (a.rooms.length === b.rooms.length) score += 0.3;
  // Можно добавить больше критериев
  return score;
}
```

### Задача 5: Очистка localStorage

**Решение:** Добавить утилиту очистки и автоматическую очистку при загрузке.

```typescript
// В ApiStorageProvider.loadProjectsAsync()
async loadProjectsAsync(): Promise<ProjectData[]> {
  const response = await projectsApi.syncPull();
  const projects = response.data.projects.map(projectsApi.apiToClientProject);

  // Обновляем кэш
  this.projectsCache.clear();
  projects.forEach(p => this.projectsCache.set(p.id, p));
  this.cacheExpiry = Date.now() + this.CACHE_TTL;

  // Сохраняем также в localStorage как кэш
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));

  // !!! ОЧИСТКА локальных дубликатов !!!
  cleanupLocalDuplicates();

  return projects;
}
```

---

## Этапы реализации

### Этап 1: Анализ и диагностика ✅

- [x] Добавить логирование для отслеживания создания дубликатов
- [x] Определить существующие типы в `src/types/storage.ts` (IdMapping, IdMappingStore, ProjectStatus, DuplicateInfo)
- [ ] Создать утилиту для обнаружения дубликатов
- [ ] Протестировать сценарии возникновения дубликатов

### Этап 2: Базовые утилиты

- [x] Типы `IdMapping`, `IdMappingStore` уже определены в `src/types/storage.ts`
- [ ] Создать `src/utils/idMapper.ts` — класс `IdMapper` (с поддержкой маппинга комнат)
- [ ] Создать `src/utils/saveQueue.ts` — очередь сохранений
- [ ] Создать `src/utils/retry.ts` — retry с exponential backoff
- [ ] Добавить тесты для `IdMapper`, `SaveQueue`, `withRetry`

### Этап 3: Маппинг ID и устранение дублирования

- [ ] Модифицировать `createProjectAsync` для сохранения маппинга
- [ ] Модифицировать `createRoom` для сохранения маппинга комнат
- [ ] Переработать `saveProjectsAsync` в `src/api/storage/apiStorageProvider.ts`
- [ ] Интегрировать `SaveQueue` в `ProjectContext.scheduleSave()`
- [ ] Добавить `version` в `updateProjectAsync` для корректной работы optimistic locking
- [ ] Создать `src/utils/storageCleanup.ts`
- [ ] Интегрировать `cleanupLocalDuplicates()` в `loadProjectsAsync()`

### Этап 4: Миграция существующих пользователей

- [ ] Создать `src/utils/migration.ts` с версионированием миграций
- [ ] Реализовать `migrateV0ToV1` — обнаружение и удаление дубликатов
- [ ] Интегрировать `runMigrations()` в `ProjectContext.loadData()`
- [ ] Протестировать миграцию с реальными данными

### Этап 5: Offline-first

- [ ] Создать `src/utils/syncQueue.ts` — очередь изменений для offline
- [ ] Создать хук `useOnlineStatus()` с авто-синхронизацией
- [ ] Интегрировать `SyncQueueManager` в `ProjectContext`
- [ ] Добавить UI-индикатор offline-режима

### Этап 6: UI управления объектами

- [ ] Создать `src/utils/objectAnalyzer.ts`
- [ ] Создать `src/components/ObjectManager.tsx`
- [ ] Добавить отображение статуса синхронизации
- [ ] Добавить действия для разрешения конфликтов
- [ ] Добавить кнопку "Управление объектами" в настройки

### Этап 7: Тестирование

- [ ] Модульные тесты для `IdMapper` (включая маппинг комнат)
- [ ] Модульные тесты для `SaveQueue`
- [ ] Модульные тесты для `withRetry`
- [ ] Модульные тесты для `objectAnalyzer`
- [ ] Модульные тесты для `migration`
- [ ] Интеграционные тесты синхронизации
- [ ] Интеграционные тесты offline → online
- [ ] E2E тесты сценариев дублирования
- [ ] E2E тесты миграции

---

## API изменений

### Новые функции в ApiStorageProvider

```typescript
class ApiStorageProvider {
  // Получить список локальных проектов (не синхронизированных)
  getLocalProjects(): ProjectData[];

  // Мигрировать локальный проект на сервер
  migrateLocalProject(localId: string): Promise<ProjectData>;

  // Найти дубликаты проектов
  findDuplicates(): Promise<DuplicateInfo[]>;

  // Удалить дубликат
  removeDuplicate(duplicateId: string): Promise<void>;
}

interface DuplicateInfo {
  originalId: string;
  duplicateId: string;
  similarity: number; // 0-1
  createdAt: Date;
}
```

### Новые утилиты

| Файл | Функции | Описание |
|------|---------|----------|
| `src/utils/idMapper.ts` | `IdMapper` (singleton) | Хранилище маппингов ID (проекты + комнаты) |
| `src/utils/saveQueue.ts` | `SaveQueue` | Очередь сохранений для предотвращения гонок |
| `src/utils/retry.ts` | `withRetry()` | Retry с exponential backoff |
| `src/utils/storageCleanup.ts` | `cleanupLocalDuplicates()`, `forceCleanup()` | Очистка дубликатов |
| `src/utils/objectAnalyzer.ts` | `analyzeProjects()`, `calculateSimilarity()` | Анализ проектов |
| `src/utils/syncQueue.ts` | `SyncQueueManager` | Очередь изменений для offline-first |
| `src/utils/migration.ts` | `runMigrations()`, `migrateV0ToV1()` | Версионированные миграции данных |

### Новые хуки

| Хук | Описание |
|-----|----------|
| `useOnlineStatus()` | Отслеживание online/offline статуса с авто-синхронизацией |

### Новый UI компонент

| Компонент | Пропсы | Описание |
|-----------|--------|----------|
| `ObjectManager` | `onClose: () => void` | Модальное окно управления объектами |

### Новые API endpoint'ы (опционально)

```
GET  /api/sync/status        — статус синхронизации
POST /api/sync/resolve       — разрешение конфликтов
GET  /api/projects/local     — список локальных проектов
POST /api/projects/:id/migrate — миграция локального проекта
```

### Статус endpoint'а `POST /api/sync/push`

**Текущее состояние:** Endpoint существует (`server/src/routes/sync.ts`), но является **stub-ом** — принимает `ChangeLogEntry[]`, но не обрабатывает изменения. Клиент не использует этот endpoint.

**Решение на данный момент:** Не использовать `sync/push`. Клиент продолжает использовать прямые CRUD-endpoint'ы (`POST /api/projects`, `PUT /api/projects/:id`, и т.д.). Stub-реализация на сервере может быть удалена или реализована в будущем при переходе на протокол change log.

**Для будущего рассмотрения:** Если потребуется полноценный offline-sync с change log, то:
1. Реализовать `ChangeLogEntry` обработку на сервере
2. Перевести клиент на отправку batch изменений через `sync/push`
3. Реализовать серверное разрешение конфликтов

---

## Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Потеря данных при миграции | Средняя | Высокое | Сохранять бэкап перед миграцией в отдельный ключ localStorage |
| Конфликты при multi-device | Высокая | Среднее | Optimistic locking с `version` field, merge стратегия |
| Производительность при большом количестве проектов | Низкая | Низкое | Пагинация, ленивая загрузка, мемоизация |
| Повреждение маппингов | Низкая | Высокое | Валидация при загрузке, возможность сброса |
| Гонки при быстрых изменениях (race conditions) | Высокая | Среднее | SaveQueue с последовательным выполнением |
| Ошибки сети при синхронизации | Высокая | Среднее | Retry с exponential backoff, offline-очередь |
| Несогласованность sync/push endpoint | Средняя | Низкое | Удалить stub или реализовать change log протокол |
| Битые ссылки на комнаты после миграции | Низкая | Среднее | Маппинг ID комнат, валидация ссылок |

---

## Критерии приёмки

### Функциональные

- [ ] При входе в систему не создаётся дубликатов проектов
- [ ] Локальные проекты корректно мигрируют на сервер с сохранением данных
- [ ] UI показывает статус синхронизации каждого проекта
- [ ] Пользователь может разрешить конфликты вручную
- [ ] Нет потери данных при миграции
- [ ] Автоматическая очистка локальных дубликатов после миграции
- [ ] При быстрых изменениях не теряются данные (SaveQueue)
- [ ] При ошибках сети — retry с backoff, затем offline-очередь
- [ ] При восстановлении соединения — автоматическая синхронизация
- [ ] Маппинг ID сохраняется для проектов И комнат
- [ ] Оптимистичная блокировка работает корректно (version передаётся и проверяется)
- [ ] Миграция существующих пользователей выполняется однократно без потери данных

### Технические

- [ ] Покрытие тестами ≥ 80% для новых модулей
- [ ] Отсутствие console.error/warning в логах (кроме intentional)
- [ ] Успешное прохождение `npm run lint`
- [ ] Успешное прохождение `npm test`
- [ ] E2E тесты для сценариев синхронизации
- [ ] E2E тесты для offline → online сценариев
- [ ] E2E тесты для миграции существующих пользователей

### Пользовательские

- [ ] Пользователь видит индикатор статуса для каждого проекта
- [ ] Пользователь видит индикатор offline/online режима
- [ ] Пользователь может синхронизировать локальный проект в 1 клик
- [ ] Пользователь получает предупреждение перед удалением дубликата
- [ ] Процесс миграции занимает ≤ 3 секунд для 10 проектов
- [ ] При ошибке синхронизации пользователь получает понятное сообщение

---

## Приложения

### A. Формат маппинга (localStorage)

```json
{
  "mappings": {
    "local-1711123456789": {
      "localId": "local-1711123456789",
      "serverId": "550e8400-e29b-41d4-a716-446655440000",
      "migratedAt": "2026-03-22T10:00:00.000Z",
      "deviceId": "device-1711123400000-abc123"
    }
  },
  "lastCleanup": "2026-03-22T10:00:00.000Z"
}
```

### B. Диаграмма состояний проекта

```
┌─────────────┐     migrate()      ┌─────────────┐
│   LOCAL     │ ─────────────────▶ │   SYNCED    │
│ (локальный) │                    │ (серверный) │
└─────────────┘                    └─────────────┘
       │                                  │
       │ duplicate detected               │ delete
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│  CONFLICT   │ ◀───────────────── │  DELETED    │
│ (дубликат)  │   merge()          │ (удалён)    │
└─────────────┘                    └─────────────┘
```

### C. Чек-лист для разработчика

Перед каждым PR по этой задаче:

- [ ] Запустить `npm run lint` — ошибок нет
- [ ] Запустить `npm test` — все тесты проходят
- [ ] Проверить логику маппинга вручную (DevTools → Application → localStorage)
- [ ] Протестировать сценарий: создание локального → миграция → проверка отсутствия дубликата
- [ ] Протестировать сценарий: быстрые изменения → нет потери данных (SaveQueue)
- [ ] Протестировать сценарий: offline → изменения в очереди → online → синхронизация
- [ ] Проверить что `version` передаётся при обновлении проектов/комнат
- [ ] Обновить документацию (этот файл)

---

## История изменений

| Дата | Версия | Изменения | Автор |
|------|--------|-----------|-------|
| 2026-03-22 | 1.0 | Начальная версия спецификации | AI Assistant |
| 2026-03-22 | 1.1 | Добавлены детали реализации, диаграммы, примеры кода | AI Assistant |
| 2026-03-22 | 1.2 | Добавлены: анализ существующих типов, SaveQueue, retry, маппинг комнат, optimistic locking, offline-first, миграция, обновлены этапы и критерии | AI Assistant |

---

**Связанные документы:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) — общая архитектура проекта
- [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) — миграция на БД
- [TECHNICAL_SPECS.md](./TECHNICAL_SPECS.md) — технические спецификации