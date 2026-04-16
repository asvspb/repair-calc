# Application Index - Repair Calculator

**Last Updated:** 2026-04-16
**Application Name:** Мой ремонт (Repair Calculator)
**Version:** 1.1.0

---

## 📋 Quick Overview

**Purpose:** Web application for calculating renovation/repair costs for rooms with detailed breakdown of works and materials.

**Tech Stack:**
- **Frontend:** React 19 + TypeScript + Vite 6
- **Backend:** Express + MySQL + Knex
- **Styling:** Tailwind CSS 4
- **State Management:** React Context + localStorage + API sync
- **Testing:** Vitest (841 тест, 833 passed) + Playwright (E2E)
- **Linting:** ESLint 10 (flat config, no-console: error, typescript-eslint)
- **Icons:** Lucide React

**Key Features:**
- Multi-project management with objects (real estate)
- Three geometry modes: Simple, Extended (multi-section), Advanced (professional)
- Automatic cost calculation (works + materials + tools)
- Auto-save to localStorage with server sync
- JWT Authentication
- JSON backup/restore
- CSV export for Excel
- AI price search via Gemini API
- Structured logging: Winston (server) + logger.ts (client)

---

## 🏗️ Architecture

### Entry Points
- `index.html` - HTML entry point
- `src/main.tsx` - React app bootstrap
- `src/App.tsx` - Main application component (~170 lines) ✅ Декомпозирован

### Core Structure
```
src/
├── App.tsx                    # Main app (~475 lines)
├── main.tsx                   # React root
├── index.css                  # TailwindCSS
│
├── api/                       # API clients
│   ├── auth.ts                # Authentication
│   ├── projects.ts, rooms.ts, sync.ts, users.ts
│   ├── storage/apiStorageProvider.ts
│   └── prices/                # AI price search
│
├── components/
│   ├── auth/                  # Login, Register, ProtectedRoute
│   ├── geometry/              # Geometry module (8 files)
│   ├── layout/                # LeftSidebar, RightSidebar, Settings
│   ├── objects/               # ObjectCard, ObjectSelector, CreateModal
│   ├── projects/              # ProjectsList, ProjectsModal
│   ├── rooms/                 # RoomList, RoomListItem
│   ├── works/                 # WorkList, MaterialCards (10 files)
│   ├── summary/               # Summary views (3 files)
│   ├── ui/                    # ConfirmDialog, ErrorBoundary, NumberInput
│   ├── BackupManager.tsx
│   ├── RoomEditor.tsx         # (~906 lines)
│   └── SummaryView.tsx
│
├── contexts/
│   ├── AuthContext.tsx        # JWT authentication
│   ├── ProjectContext.tsx     # Project state (~981 lines)
│   └── WorkTemplateContext.tsx
│
├── types/
│   ├── index.ts               # Main types (ProjectData, ObjectData...)
│   ├── auth.ts, storage.ts, workTemplate.ts
│
└── utils/
    ├── costs.ts, geometry.ts, factories.ts
    ├── logger.ts           # Structured logger (logError, logWarning, logDebug)
    ├── storage.ts, idMapper.ts, projectObjects.ts, migration.ts
```

### Data Model (TypeScript Types)

**ProjectData (v2):**
```typescript
{
  id: string
  name: string
  description?: string
  isPremium?: boolean
  objects: ObjectData[]      // Objects (real estate)
  version?: number
  // Deprecated (backward compatibility)
  rooms?: RoomData[]
  city?: string
  useAiPricing?: boolean
}
```

**ObjectData:**
```typescript
{
  id: string
  projectId: string
  name: string
  city?: string
  address?: string
  useAiPricing?: boolean
  rooms: RoomData[]
  version?: number
}
```

**RoomData:**
```typescript
{
  id: string
  name: string
  geometryMode: 'simple' | 'extended' | 'advanced'
  length, width, height: number
  windows: Opening[]
  doors: Opening[]
  works: WorkData[]
  segments: RoomSegment[]        // Advanced mode
  obstacles: Obstacle[]          // Advanced mode
  wallSections: WallSection[]    // Advanced mode
  subSections: RoomSubSection[]  // Extended mode
}
```

### Data Hierarchy

```
User → Project → Object → Room → Work → Material/Tool
```

### Geometry Modes

| Mode | Description | Key Features |
|------|-------------|--------------|
| **Simple** | Single rectangular room | Basic length×width, windows, doors |
| **Extended** | Multiple subsections | Different shapes per subsection |
| **Advanced** | Professional mode | Segments, obstacles, wall height variations |

### Calculation Logic

**Metrics** (`src/utils/geometry.ts`):
- `floorArea` - Total floor area (m²)
- `perimeter` - Room perimeter (m)
- `netWallArea` - Wall area minus openings (m²)
- `skirtingLength` - Perimeter minus door widths (m)
- `volume` - Room volume (m³)

**Costs** (`src/utils/costs.ts`):
- Work cost = quantity × workUnitPrice
- Material cost = Σ(quantity × pricePerUnit)
- Tool cost = Σ(quantity × price) [× rentPeriod if rental]

---

## 🔧 Key Components

### App.tsx (~170 lines)
- **Views:** `summary`, `room`, `projects`
- **Composition:** Renders `ProjectProvider`, `WorkTemplateProvider`, navigation

### RoomEditor.tsx (~843 lines)
- **State:** Uses `useProjectContext`, `useGeometryState`
- **Sections:** Geometry, Works, Materials

### Contexts
- `ProjectContext` — Projects, rooms, auto-save (1s debounce)
- `WorkTemplateContext` — Work templates management

### Hooks
- `useGeometryState` — Geometry mode, dimensions, openings
- `useMaterialCalculation` — Auto material quantity calculation

---

## 🚀 Development

### Prerequisites
- Node.js 18+

### Commands
```bash
npm install          # Install dependencies
npm run dev          # Dev server on port 3993
npm run build        # Production build
npm run preview      # Preview production build
npm test             # Run Vitest tests
npm run test:e2e     # Run Playwright e2e tests
npm run lint         # TypeScript type check
```

### Environment
- **Port:** 3993
- **Env File:** `.env.local` with `VITE_GEMINI_API_KEY=your_key`

---

## 📦 Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| react, react-dom | ^19.0.0 | UI framework |
| lucide-react | ^0.546.0 | Icons |
| @dnd-kit/* | ^6.3+ | Drag-and-drop |
| tailwindcss | ^4.1.14 | Styling |
| vite | ^6.2.0 | Build tool |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ~5.8.2 | Type checking |
| vitest | ^4.0.18 | Unit testing |
| @playwright/test | ^1.58.2 | E2E testing |
| @testing-library/react | ^16.3.2 | React testing |

---

## 🗄️ Data Persistence

### Current Architecture (MySQL + Backend)
- **Server:** Express + MySQL (Docker)
- **Auth:** JWT tokens
- **Frontend:** Port 3993
- **Backend:** Port 3994
- **Database:** MySQL 8 (utf8mb4)

### Offline Support
- **Queue:** IndexedDB for pending changes
- **Sync:** Auto-sync on reconnect

---

## 🧪 Testing

### Test Statistics (2026-04-16)
| Category | Count |
|----------|-------|
| Unit tests | 292+ |
| Integration tests | 29+ |
| E2E tests | 13 files |
| **Total** | **841** |

### Results
- **Passed:** 833
- **Failed:** 0
- **Skipped:** 8

> **Fix (2026-04-16):** Added `localStorage` mock in `tests/setup.ts` — Vitest 4.x + jsdom 26 provides an empty object without Storage methods, causing 10 test failures.
>
> **Logging Migration (2026-04-16):** All `console.*` replaced with structured loggers — server uses `winstonLogger` (Winston), client uses `src/utils/logger.ts` (`logError`, `logWarning`, `logDebug`). Knex migrations remain on `console.log` (CLI context).

### E2E Status
- ✅ auth.spec.ts — 3/3
- ✅ objects.spec.ts — 4/4
- ✅ export-import.spec.ts — 3/3
- 🔧 Others — skipped (require backend mocks)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [../INDEX.md](../INDEX.md) | Главный индекс (наиболее актуальный) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура проекта |
| [TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md) | ТЗ v1.1 |
| [TODO.md](./TODO.md) | Рабочий бэклог |
| [PROGRESS.md](./PROGRESS.md) | История прогресса |
| [FRONTEND-STATUS.md](./FRONTEND-STATUS.md) | Статус Frontend |
| [CODE_REVIEW.md](./CODE_REVIEW.md) | Код-ревью v5.0 |
| [LOGGING.md](./LOGGING.md) | Руководство по логированию |

---

## 🚨 Notes for AI Agents

### Before Making Changes
1. Read `../INDEX.md` for current state
2. Check `docs/TODO.md` for current tasks
3. Check `docs/ARCHITECTURE.md` for architecture details

### After Making Changes
1. Update relevant documentation
2. Run tests: `npm test`
3. Update `../INDEX.md` if structure changed
4. Update dates in modified documents

---

**End of Index**