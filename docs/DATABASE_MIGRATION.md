# Техническое задание: Миграция на базу данных

**Дата создания:** 2026-03-13
**Статус:** Проект
**Приоритет:** Высокий
**Оценка:** 15-20 рабочих дней

---

## 1. Цель и контекст

### 1.1 Цель

Перевести приложение с локального хранилища браузера (localStorage) на серверную архитектуру с базой данных MySQL для обеспечения:

1. **Многопользовательского режима** — каждый пользователь работает со своими проектами
2. **Надёжного хранения данных** — защита от потери данных при очистке браузера
3. **Синхронизации между устройствами** — доступ к проектам с любого устройства
4. **AI-интеграции** — серверные запросы к Gemini/Mistral API

### 1.2 Текущее состояние

| Компонент | Реализация |
|-----------|------------|
| Хранилище | localStorage |
| Абстракция | `IStorageProvider` в `src/types/storage.ts` |
| Провайдер | `LocalStorageProvider` в `src/utils/localStorageProvider.ts` |
| Менеджер | `StorageManager` в `src/utils/storage.ts` |
| Контекст | `ProjectContext` с автосохранением (debounce 1 сек) |
| Структуры данных | `ProjectData`, `RoomData`, `WorkData` в `src/types/index.ts` |

### 1.3 Целевая архитектура

```
┌─────────────────┐     HTTP/REST      ┌─────────────────┐
│   React Client  │ ◄───────────────► │  Express Server  │
│   (port 3993)   │                    │   (port 3994)    │
└─────────────────┘                    └────────┬────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │    MySQL DB     │
                                       │   (port 3306)   │
                                       └─────────────────┘
```

---

## 2. Серверная часть

### 2.1 Структура проекта

```
server/
├── src/
│   ├── index.ts                    -- Entry point
│   ├── app.ts                      -- Express app setup
│   ├── config/
│   │   ├── database.ts             -- MySQL connection pool
│   │   ├── env.ts                  -- Environment variables
│   │   ├── ai.ts                   -- AI providers config
│   │   └── redis.ts                -- Redis client (optional caching)
│   ├── routes/
│   │   ├── index.ts                -- Router aggregation
│   │   ├── auth.ts                 -- POST /api/auth/login, /register, /refresh
│   │   ├── projects.ts             -- CRUD /api/projects
│   │   ├── rooms.ts                -- CRUD /api/rooms
│   │   ├── works.ts                -- CRUD /api/works
│   │   ├── materials.ts            -- CRUD /api/materials
│   │   ├── tools.ts                -- CRUD /api/tools
│   │   ├── sync.ts                 -- POST /api/sync/push|pull
│   │   ├── ai.ts                   -- POST /api/ai/*
│   │   └── health.ts               -- GET /api/health
│   ├── middleware/
│   │   ├── auth.ts                 -- JWT verification
│   │   ├── errorHandler.ts         -- Global error handler
│   │   ├── validation.ts           -- Zod validation
│   │   ├── rateLimiter.ts          -- Rate limiting for AI/endpoints
│   │   └── logger.ts               -- Winston request logging
│   ├── services/
│   │   ├── calculations.ts         -- Shared calculations (from src/utils/)
│   │   └── ai/
│   │       ├── provider.ts         -- Abstract AIProvider
│   │       ├── gemini.ts           -- GeminiProvider
│   │       └── mistral.ts           -- MistralProvider
│   ├── db/
│   │   ├── pool.ts                 -- MySQL pool singleton
│   │   ├── migrations/             -- Knex migrations
│   │   │   └── 20260313_initial.ts
│   │   └── repositories/
│   │       ├── user.repo.ts
│   │       ├── project.repo.ts
│   │       ├── room.repo.ts
│   │       └── work.repo.ts
│   └── types/
│       ├── user.ts
│       ├── project.ts
│       └── api.ts
├── knexfile.ts
├── tsconfig.json
└── package.json
```

### 2.2 Зависимости сервера

```json
{
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "mysql2": "^3.11.0",
    "knex": "^3.1.0",
    "zod": "^3.23.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^10.0.0",
    "@google/genai": "^0.3.0",
    "@mistralai/mistralai": "^0.5.0",
    "express-rate-limit": "^7.5.0",
    "winston": "^3.17.0",
    "redis": "^4.7.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/bcryptjs": "^2.4.6",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "@types/express-rate-limit": "^6.0.0"
  }
}
```

---

## 3. Схема базы данных

### 3.1 ER-диаграмма

```
users 1──∞ projects 1──∞ rooms 1──∞ works 1──∞ materials
                                      └──∞ tools
                                      
rooms 1──∞ openings
rooms 1──∞ room_subsections (extended mode)
rooms 1──∞ room_segments (advanced mode)
rooms 1──∞ room_obstacles (advanced mode)
rooms 1──∞ wall_sections (advanced mode)

room_subsections 1──∞ openings (extended mode)
```

### 3.2 SQL-схема

```sql
-- ═══════════════════════════════════════════════════════
-- СПРАВОЧНИКИ
-- ═══════════════════════════════════════════════════════
CREATE TABLE units (
  id    VARCHAR(36) PRIMARY KEY,
  code  VARCHAR(10) NOT NULL UNIQUE,
  name  VARCHAR(100) NOT NULL
);

-- ═══════════════════════════════════════════════════════
-- ПОЛЬЗОВАТЕЛИ
-- ═══════════════════════════════════════════════════════
CREATE TABLE users (
  id            VARCHAR(36) PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_deleted (deleted_at)
);

-- ═══════════════════════════════════════════════════════
-- ПРОЕКТЫ
-- ═══════════════════════════════════════════════════════
CREATE TABLE projects (
  id              VARCHAR(36) PRIMARY KEY,
  user_id         VARCHAR(36) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  city            VARCHAR(100),
  use_ai_pricing  BOOLEAN DEFAULT FALSE,
  last_ai_price_update TIMESTAMP NULL,
  version         INT DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_deleted (deleted_at)
);

-- ═══════════════════════════════════════════════════════
-- КОМНАТЫ
-- ═══════════════════════════════════════════════════════
CREATE TABLE rooms (
  id             VARCHAR(36) PRIMARY KEY,
  project_id     VARCHAR(36) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  geometry_mode  ENUM('simple','extended','advanced') DEFAULT 'simple',
  length         DECIMAL(12,4) DEFAULT 0,
  width          DECIMAL(12,4) DEFAULT 0,
  height         DECIMAL(12,4) DEFAULT 0,
  version        INT DEFAULT 1,
  sort_order     INT DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMP NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_project_id (project_id),
  INDEX idx_project_sort (project_id, sort_order),
  INDEX idx_deleted (deleted_at)
);

-- ═══════════════════════════════════════════════════════
-- ПРОЁМЫ (окна/двери)
-- ═══════════════════════════════════════════════════════
CREATE TABLE openings (
  id              VARCHAR(36) PRIMARY KEY,
  room_id         VARCHAR(36) NOT NULL,
  type            ENUM('window','door') NOT NULL,
  width           DECIMAL(12,4) NOT NULL,
  height          DECIMAL(12,4) NOT NULL,
  comment         VARCHAR(500),
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room_id (room_id),
  INDEX idx_room_sort (room_id, sort_order)
);

-- ═══════════════════════════════════════════════════════
-- EXTENDED MODE: секции помещения
-- ═══════════════════════════════════════════════════════
CREATE TABLE room_subsections (
  id          VARCHAR(36) PRIMARY KEY,
  room_id     VARCHAR(36) NOT NULL,
  name        VARCHAR(255),
  shape       ENUM('rectangle','trapezoid','triangle','parallelogram') DEFAULT 'rectangle',
  length      DECIMAL(12,4) DEFAULT 0,
  width       DECIMAL(12,4) DEFAULT 0,
  base1       DECIMAL(12,4) NULL,
  base2       DECIMAL(12,4) NULL,
  depth       DECIMAL(12,4) NULL,
  side1       DECIMAL(12,4) NULL,
  side2       DECIMAL(12,4) NULL,
  side_a      DECIMAL(12,4) NULL,
  side_b      DECIMAL(12,4) NULL,
  side_c      DECIMAL(12,4) NULL,
  base        DECIMAL(12,4) NULL,
  side        DECIMAL(12,4) NULL,
  version     INT DEFAULT 1,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room_id (room_id),
  INDEX idx_room_sort (room_id, sort_order)
);

-- ═══════════════════════════════════════════════════════
-- ADVANCED MODE: сегменты, препятствия, перепады
-- ═══════════════════════════════════════════════════════
CREATE TABLE room_segments (
  id         VARCHAR(36) PRIMARY KEY,
  room_id    VARCHAR(36) NOT NULL,
  name       VARCHAR(255),
  length     DECIMAL(12,4) DEFAULT 0,
  width      DECIMAL(12,4) DEFAULT 0,
  operation  ENUM('add','subtract') DEFAULT 'subtract',
  version    INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room_id (room_id),
  INDEX idx_room_sort (room_id, sort_order)
);

CREATE TABLE room_obstacles (
  id         VARCHAR(36) PRIMARY KEY,
  room_id    VARCHAR(36) NOT NULL,
  name       VARCHAR(255),
  type       ENUM('column','duct','niche','other') DEFAULT 'column',
  area       DECIMAL(12,4) DEFAULT 0,
  perimeter  DECIMAL(12,4) DEFAULT 0,
  operation  ENUM('add','subtract') DEFAULT 'subtract',
  version    INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room_id (room_id),
  INDEX idx_room_sort (room_id, sort_order)
);

CREATE TABLE wall_sections (
  id         VARCHAR(36) PRIMARY KEY,
  room_id    VARCHAR(36) NOT NULL,
  name       VARCHAR(255),
  length     DECIMAL(12,4) DEFAULT 0,
  height     DECIMAL(12,4) DEFAULT 0,
  version    INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room_id (room_id),
  INDEX idx_room_sort (room_id, sort_order)
);

-- ═══════════════════════════════════════════════════════
-- РАБОТЫ
-- ═══════════════════════════════════════════════════════
CREATE TABLE works (
  id                VARCHAR(36) PRIMARY KEY,
  room_id           VARCHAR(36) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  unit              VARCHAR(36) DEFAULT 'м²',
  enabled           BOOLEAN DEFAULT TRUE,
  work_unit_price   DECIMAL(12,2) DEFAULT 0,
  calculation_type  ENUM('floorArea','netWallArea','skirtingLength','customCount') DEFAULT 'floorArea',
  count             INT NULL,
  manual_qty        DECIMAL(10,3) NULL,
  use_manual_qty    BOOLEAN DEFAULT FALSE,
  is_custom         BOOLEAN DEFAULT TRUE,
  version           INT DEFAULT 1,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room_id (room_id),
  INDEX idx_room_sort (room_id, sort_order)
);

-- ═══════════════════════════════════════════════════════
-- МАТЕРИАЛЫ
-- ═══════════════════════════════════════════════════════
CREATE TABLE materials (
  id                VARCHAR(36) PRIMARY KEY,
  work_id           VARCHAR(36) NOT NULL,
  name              VARCHAR(255),
  quantity          DECIMAL(10,3) DEFAULT 1,
  unit              VARCHAR(36) DEFAULT 'м²',
  price_per_unit    DECIMAL(12,2) DEFAULT 0,
  coverage_per_unit DECIMAL(10,3) NULL,
  consumption_rate  DECIMAL(10,3) NULL,
  layers            INT DEFAULT 1,
  pieces_per_unit   INT NULL,
  waste_percent     DECIMAL(5,2) DEFAULT 10,
  package_size      DECIMAL(10,3) NULL,
  is_perimeter      BOOLEAN DEFAULT FALSE,
  multiplier        DECIMAL(10,3) DEFAULT 1,
  auto_calc_enabled BOOLEAN DEFAULT FALSE,
  version           INT DEFAULT 1,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
  INDEX idx_work_id (work_id),
  INDEX idx_work_sort (work_id, sort_order)
);

-- ═══════════════════════════════════════════════════════
-- ИНСТРУМЕНТЫ
-- ═══════════════════════════════════════════════════════
CREATE TABLE tools (
  id          VARCHAR(36) PRIMARY KEY,
  work_id     VARCHAR(36) NOT NULL,
  name        VARCHAR(255),
  quantity    INT DEFAULT 1,
  price       DECIMAL(12,2) DEFAULT 0,
  is_rent     BOOLEAN DEFAULT FALSE,
  rent_period INT NULL,
  version     INT DEFAULT 1,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
  INDEX idx_work_id (work_id),
  INDEX idx_work_sort (work_id, sort_order)
);

-- ═══════════════════════════════════════════════════════
-- AI: история запросов
-- ═══════════════════════════════════════════════════════
CREATE TABLE ai_requests (
  id           VARCHAR(36) PRIMARY KEY,
  user_id      VARCHAR(36) NOT NULL,
  project_id   VARCHAR(36) NULL,
  provider     ENUM('gemini','mistral') NOT NULL,
  request_type VARCHAR(50) NOT NULL,
  prompt_hash  VARCHAR(64),
  response     JSON,
  tokens_used  INT DEFAULT 0,
  cost_usd     DECIMAL(10,6) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_project_id (project_id),
  INDEX idx_prompt_hash (prompt_hash, provider)
);

-- ═══════════════════════════════════════════════════════
-- КЭШ ВЫЧИСЛЕНИЙ
-- ═══════════════════════════════════════════════════════
CREATE TABLE calculated_totals (
  project_id      VARCHAR(36) PRIMARY KEY,
  total_area      DECIMAL(12,2),
  total_works     DECIMAL(12,2),
  total_materials DECIMAL(12,2),
  total_tools     DECIMAL(12,2),
  grand_total     DECIMAL(12,2),
  calculated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════
-- AUDIT LOG
-- ═══════════════════════════════════════════════════════
CREATE TABLE audit_log (
  id           VARCHAR(36) PRIMARY KEY,
  user_id      VARCHAR(36) NOT NULL,
  action       VARCHAR(50) NOT NULL,
  entity_type  VARCHAR(50) NOT NULL,
  entity_id    VARCHAR(36) NOT NULL,
  old_values   JSON NULL,
  new_values   JSON NULL,
  ip_address   VARCHAR(45),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_action (user_id, created_at),
  INDEX idx_entity (entity_type, entity_id)
);
```

---

## 4. REST API

### 4.1 Аутентификация

```
POST /api/auth/register
  Body: { email, password, name? }
  Response: { user: { id, email, name }, token, refreshToken }

POST /api/auth/login
  Body: { email, password }
  Response: { user: { id, email, name }, token, refreshToken }

POST /api/auth/refresh
  Body: { refreshToken }
  Response: { token, refreshToken }

GET /api/auth/me
  Header: Authorization: Bearer <token>
  Response: { user: { id, email, name } }

POST /api/auth/logout
  Header: Authorization: Bearer <token>
  Response: { success: true }
```

### 4.2 Проекты

```
GET    /api/projects                    # Список проектов пользователя
POST   /api/projects                    # Создать проект
GET    /api/projects/:id                # Полный проект (rooms + works + geometry)
PUT    /api/projects/:id                # Обновить проект
DELETE /api/projects/:id                # Удалить проект
PUT    /api/projects/:id/ai-settings    # Обновить настройки AI
```

### 4.3 Комнаты

```
POST   /api/projects/:projectId/rooms        # Добавить комнату
GET    /api/rooms/:id                         # Комната со всей геометрией и работами
PUT    /api/rooms/:id                          # Обновить комнату
DELETE /api/rooms/:id                          # Удалить комнату
PUT    /api/projects/:projectId/rooms/order   # Порядок комнат (drag-and-drop)
```

### 4.4 Работы, материалы, инструменты

```
POST   /api/rooms/:roomId/works           # Добавить работу
PUT    /api/works/:id                      # Обновить работу
DELETE /api/works/:id                      # Удалить работу
PUT    /api/rooms/:roomId/works/order      # Порядок работ

POST   /api/works/:workId/materials        # Добавить материал
PUT    /api/materials/:id                   # Обновить материал
DELETE /api/materials/:id                   # Удалить материал

POST   /api/works/:workId/tools            # Добавить инструмент
PUT    /api/tools/:id                       # Обновить инструмент
DELETE /api/tools/:id                       # Удалить инструмент
```

### 4.5 Геометрия

```
POST   /api/rooms/:roomId/openings         # Добавить проём
PUT    /api/openings/:id                    # Обновить проём
DELETE /api/openings/:id                    # Удалить проём

POST   /api/rooms/:roomId/subsections      # Добавить секцию (extended)
PUT    /api/subsections/:id                 # Обновить секцию
DELETE /api/subsections/:id                 # Удалить секцию

POST   /api/rooms/:roomId/segments         # Добавить сегмент (advanced)
PUT    /api/segments/:id                     # Обновить сегмент
DELETE /api/segments/:id                     # Удалить сегмент

POST   /api/rooms/:roomId/obstacles        # Добавить препятствие (advanced)
PUT    /api/obstacles/:id                    # Обновить препятствие
DELETE /api/obstacles/:id                    # Удалить препятствие

POST   /api/rooms/:roomId/wall-sections    # Добавить перепад (advanced)
PUT    /api/wall-sections/:id                # Обновить перепад
DELETE /api/wall-sections/:id                # Удалить перепад
```

### 4.8 Health & Monitoring

```
GET /api/health
  Response: { 
    status: 'ok',
    uptime: 123456,
    database: 'connected',
    ai_providers: { gemini: 'ok', mistral: 'ok' },
    timestamp: '2026-03-13T10:00:00Z'
  }

GET /api/metrics
  Response: { 
    active_users: 42,
    total_projects: 156,
    ai_requests_today: 89,
    avg_response_time_ms: 145
  }
```

### 4.9 Синхронизация (offline-first)

```
POST /api/sync/push                        # Отправить локальные изменения
  Body: { changes: ChangeLogEntry[] }
  Response: { synced: string[], conflicts: Conflict[] }

GET  /api/sync/pull?since=<timestamp>      # Получить изменения с сервера
  Response: { projects: ProjectData[], timestamp: string }
```

### 4.10 AI

```
POST /api/ai/estimate                      # Оценка стоимости по описанию
POST /api/ai/suggest-materials             # Предложить материалы для работы
POST /api/ai/generate-template             # Шаблон работ для типа комнаты
```

---

## 5. Клиентская часть

### 5.1 Новый ApiStorageProvider

```typescript
// src/utils/apiStorageProvider.ts
import type { IStorageProvider } from '../types/storage';
import type { ProjectData } from '../types';

interface ApiClientConfig {
  baseUrl: string;
  getToken: () => string | null;
}

export class ApiStorageProvider implements IStorageProvider {
  private config: ApiClientConfig;
  
  constructor(config: ApiClientConfig) {
    this.config = config;
  }
  
  // IStorageProvider implementation
  get<T>(key: string): T | null {
    // Для API провайдера это заглушка
    // Реальные данные получаем через API методы
    return null;
  }
  
  set<T>(key: string, value: T): void {
    // Заглушка — реальное сохранение через API методы
  }
  
  remove(key: string): void {
    // Заглушка
  }
  
  clear(): void {
    // Заглушка
  }
  
  getStorageInfo(): { used: number; total: number; percentage: number } {
    return { used: 0, total: 0, percentage: 0 };
  }
  
  // API-specific методы
  async getProjects(): Promise<ProjectData[]> {
    const response = await fetch(`${this.config.baseUrl}/api/projects`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  }
  
  async getProject(id: string): Promise<ProjectData> {
    const response = await fetch(`${this.config.baseUrl}/api/projects/${id}`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch project');
    return response.json();
  }
  
  async saveProject(project: ProjectData): Promise<ProjectData> {
    const response = await fetch(`${this.config.baseUrl}/api/projects/${project.id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(project)
    });
    if (!response.ok) throw new Error('Failed to save project');
    return response.json();
  }
  
  // ... другие методы API
  
  private getAuthHeaders(): HeadersInit {
    const token = this.config.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }
}
```

### 5.2 AuthContext

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('auth_token')
  );
  const [isLoading, setIsLoading] = useState(true);
  
  // Автоматический вход при наличии токена
  useEffect(() => {
    if (token) {
      fetchMe(token).then(userData => {
        setUser(userData);
        setIsLoading(false);
      }).catch(() => {
        setToken(null);
        localStorage.removeItem('auth_token');
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [token]);
  
  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Login failed');
    const data = await response.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('auth_token', data.token);
  };
  
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };
  
  // ... register и другие методы
  
  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### 5.3 Обновление ProjectContext

```typescript
// Добавить в src/contexts/ProjectContext.tsx

// Переключение между localStorage и API
const useApiStorage = import.meta.env.VITE_USE_API_STORAGE === 'true';

// Инициализация провайдера
useEffect(() => {
  if (useApiStorage && isAuthenticated) {
    StorageManager.setProvider(new ApiStorageProvider({
      baseUrl: import.meta.env.VITE_API_URL,
      getToken: () => token
    }));
  } else {
    StorageManager.setProvider(LocalStorageProvider.getInstance());
  }
}, [isAuthenticated, token]);
```

---

## 6. Offline-First стратегия

### 6.1 IndexedDB для очереди синхронизации

```typescript
// src/utils/offlineQueue.ts
import { openDB, type IDBPDatabase } from 'idb';

interface ChangeLogEntry {
  id: string;
  timestamp: number;
  operation: 'create' | 'update' | 'delete';
  entity: 'project' | 'room' | 'work' | 'material' | 'tool';
  entityId: string;
  data: unknown;
}

class OfflineQueue {
  private db: IDBPDatabase | null = null;
  
  async init() {
    this.db = await openDB('repair-calc-offline', 1, {
      upgrade(db) {
        db.createObjectStore('changes', { keyPath: 'id' });
        db.createObjectStore('cache', { keyPath: 'id' });
      }
    });
  }
  
  async addChange(change: ChangeLogEntry): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('changes', change);
  }
  
  async getPendingChanges(): Promise<ChangeLogEntry[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('changes');
  }
  
  async clearChanges(ids: string[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('changes', 'readwrite');
    for (const id of ids) {
      await tx.store.delete(id);
    }
  }
  
  async cacheProject(project: ProjectData): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('cache', { id: project.id, data: project });
  }
}

export const offlineQueue = new OfflineQueue();
```

### 6.2 Синхронизация

```typescript
// src/utils/sync.ts
import { offlineQueue } from './offlineQueue';

export async function syncPush(): Promise<void> {
  const changes = await offlineQueue.getPendingChanges();
  if (changes.length === 0) return;
  
  const response = await fetch('/api/sync/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({ changes })
  });
  
  if (response.ok) {
    const { synced } = await response.json();
    await offlineQueue.clearChanges(synced);
  }
}

export async function syncPull(since?: number): Promise<ProjectData[]> {
  const url = since 
    ? `/api/sync/pull?since=${since}`
    : '/api/sync/pull';
    
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  
  if (!response.ok) throw new Error('Sync pull failed');
  
  const { projects } = await response.json();
  
  // Кэшируем в IndexedDB
  for (const project of projects) {
    await offlineQueue.cacheProject(project);
  }
  
  return projects;
}
```

---

## 7. План реализации

### Фаза 1: Подготовка сервера (3-4 дня)

- [ ] **1.1** Создать структуру `server/` с TypeScript
- [ ] **1.2** Настроить Express + middleware (cors, errorHandler)
- [ ] **1.3** Настроить MySQL connection pool (mysql2/promise)
- [ ] **1.4** Создать Knex-миграции для всех таблиц
- [ ] **1.5** Написать репозитории (UserRepository, ProjectRepository, RoomRepository, WorkRepository)
- [ ] **1.6** Добавить zod-схемы валидации для всех входных данных

### Фаза 2: Аутентификация (2-3 дня)

- [ ] **2.1** Реализовать регистрацию (POST /api/auth/register)
- [ ] **2.2** Реализовать вход (POST /api/auth/login)
- [ ] **2.3** Реализовать JWT middleware
- [ ] **2.4** Создать AuthContext на клиенте
- [ ] **2.5** Создать страницы Login/Register
- [ ] **2.6** Добавить защиту роутов (PrivateRoute)

### Фаза 3: CRUD для проектов (3-4 дня)

- [ ] **3.1** GET /api/projects — список проектов пользователя
- [ ] **3.2** POST /api/projects — создать проект
- [ ] **3.3** GET /api/projects/:id — получить проект с вложениями
- [ ] **3.4** PUT /api/projects/:id — обновить проект
- [ ] **3.5** DELETE /api/projects/:id — удалить проект
- [ ] **3.6** Реализовать ApiStorageProvider на клиенте
- [ ] **3.7** Интегрировать в ProjectContext

### Фаза 4: CRUD для комнат и работ (2-3 дня)

- [ ] **4.1** Все CRUD для rooms
- [ ] **4.2** Все CRUD для works, materials, tools
- [ ] **4.3** Все CRUD для геометрии (openings, subsections, segments, obstacles, wall_sections)
- [ ] **4.4** Drag-and-drop сортировка (rooms/order, works/order)

### Фаза 5: Offline-first (2-3 дня)

- [ ] **5.1** Установить idb (IndexedDB wrapper)
- [ ] **5.2** Реализовать OfflineQueue для хранения изменений
- [ ] **5.3** Реализовать POST /api/sync/pull
- [ ] **5.4** Реализовать GET /api/sync/push
- [ ] **5.5** Добавить детекцию online/offline статуса
- [ ] **5.6** UI-индикатор синхронизации

### Фаза 6: AI-интеграция (3-4 дня)

- [ ] **6.1** Абстрактный AIProvider интерфейс
- [ ] **6.2** GeminiProvider (@google/genai)
- [ ] **6.3** MistralProvider (@mistralai/mistralai)
- [ ] **6.4** POST /api/ai/estimate
- [ ] **6.5** POST /api/ai/suggest-materials
- [ ] **6.6** Кэширование ответов в ai_requests

### Фаза 7: Тестирование и PWA (2-3 дня)

- [ ] **7.1** Unit-тесты для сервера (Jest + Supertest)
- [ ] **7.2** Integration-тесты API
- [ ] **7.3** Установить vite-plugin-pwa
- [ ] **7.4** Настроить service worker
- [ ] **7.5** Создать иконки (192, 512, maskable)
- [ ] **7.6** Протестировать offline-режим

---

## 8. Переменные окружения

### 8.1 Сервер (.env)

```env
# Server
PORT=3994
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=repair_user
DB_PASSWORD=secure_password
DB_NAME=repair_calc
DB_POOL_LIMIT=10
DB_IDLE_TIMEOUT=30000

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-token-secret-change-in-production
JWT_REFRESH_EXPIRES_IN=7d

# AI
GEMINI_API_KEY=your-gemini-api-key
MISTRAL_API_KEY=your-mistral-api-key

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Logging
LOG_LEVEL=info
LOG_FILE=logs/combined.log
LOG_ERROR_FILE=logs/error.log
```

### 8.2 Клиент (.env.local)

```env
# API
VITE_API_URL=http://localhost:3994
VITE_USE_API_STORAGE=true

# Feature flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_OFFLINE_MODE=true
```

---

## 9. Безопасность и валидация

### 9.1 Парольная политика

```typescript
// server/src/middleware/validation.ts
import { z } from 'zod';

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[!@#$%^&*]/, 'Must contain special character');

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(255).optional()
});
```

### 9.2 Rate Limiting

```typescript
// server/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour per IP
  message: 'AI rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many authentication attempts'
});
```

### 9.2 JWT Refresh Token Flow

```typescript
// Access token: 15 минут
// Refresh token: 7 дней (хранится в httpOnly cookie)

POST /api/auth/refresh
  Body: { refreshToken }
  Response: { token, refreshToken }

// При истечении access token:
// 1. Клиент получает 401 Unauthorized
// 2. Автоматически вызывает POST /api/auth/refresh
// 3. Повторяет оригинальный запрос с новым токеном
```

---

## 10. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Потеря данных при миграции | Средняя | Высокое | Экспорт localStorage в JSON перед миграцией |
| Конфликты синхронизации | Средняя | Среднее | Optimistic locking (version) + timestamp |
| Превышение лимитов AI API | Низкая | Среднее | Rate limiting + кэширование + Redis |
| Проблемы производительности MySQL | Низкая | Среднее | Индексы на всех FK, connection pool, кэш вычислений |
| SQL injection | Низкая | Критичное | Параметризованные запросы через Knex, Zod валидация |
| XSS через audit_log | Низкая | Среднее | Санитизация JSON перед записью |

---

## 11. Критерии приёмки

- [ ] Пользователь может зарегистрироваться и войти
- [ ] Данные сохраняются в MySQL, а не в localStorage
- [ ] Проекты изолированы между пользователями
- [ ] Offline-режим: данные сохраняются локально и синхронизируются при восстановлении связи
- [ ] AI-поиск цен работает через сервер
- [ ] Все существующие тесты проходят
- [ ] PWA устанавливается на мобильное устройство
- [ ] Health check возвращает статус всех компонентов
- [ ] Rate limiting работает для AI endpoints
- [ ] Audit log записывает все критичные операции
- [ ] Кэш вычислений обновляется при изменении данных

---

## 12. Приоритеты улучшений

| Приоритет | Изменение | Сложность | Влияние |
|-----------|-----------|-----------|---------|
| **P0** | Составные индексы | Низкая | Высокое |
| **P0** | Soft delete | Средняя | Высокое |
| **P0** | Валидация паролей | Низкая | Критичное |
| **P1** | Audit log | Средняя | Среднее |
| **P1** | Кэш вычислений | Средняя | Высокое |
| **P1** | Rate limiting | Низкая | Высокое |
| **P2** | Optimistic locking (version) | Высокая | Среднее |
| **P2** | Redis кэш | Высокая | Среднее |
| **P3** | Health check | Низкая | Низкое |