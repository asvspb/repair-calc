# Application Index - Repair Calculator

**Last Updated:** 2026-04-17
**Application Name:** Мой ремонт (Repair Calculator)
**Version:** 1.1.0

---

## Quick Overview

**Purpose:** Web application for calculating renovation/repair costs for rooms with detailed breakdown of works and materials.

**Tech Stack:**
- **Frontend:** React 19 + TypeScript 5.8 + Vite 6
- **Backend:** Express 4 + MySQL 8 + Knex 3
- **Styling:** TailwindCSS 4
- **State Management:** React Context + localStorage + API sync
- **Testing:** Vitest (841 tests) + Playwright (E2E, 13 files)
- **Linting:** ESLint 10 (flat config, no-console: error)
- **Icons:** Lucide React
- **Logging:** Winston (server) + logger.ts (client)

**Key Features:**
- Multi-project management with objects (real estate)
- Three geometry modes: Simple, Extended, Advanced
- Automatic cost calculation (works + materials + tools)
- Auto-save to localStorage with server sync
- JWT Authentication
- JSON backup/restore
- CSV export for Excel
- AI price search via Gemini/Mistral API
- Structured logging

---

## Architecture

### Entry Points
- `index.html` - HTML entry point
- `src/main.tsx` - React app bootstrap
- `src/App.tsx` - Main application component (~470 lines)

### Core Structure
```
src/
├── App.tsx                    # Main app (~470 lines)
├── main.tsx                   # React root
├── index.css                  # TailwindCSS
│
├── api/                       # API clients (9 файлов + prices/)
│   ├── auth.ts                # Authentication
│   ├── httpClient.ts          # HTTP client (interceptors, retry, timeout)
│   ├── objects.ts             # Objects API
│   ├── projects.ts            # Projects API
│   ├── rooms.ts               # Rooms API
│   ├── totals.ts              # Totals API
│   ├── users.ts               # Users API
│   ├── storage/
│   │   ├── apiStorageProvider.ts  # REST API storage provider
│   │   └── index.ts
│   └── prices/                # AI price search (6 файлов)
│
├── components/
│   ├── auth/                  # (4 файла: Login, Register, ProtectedRoute, index)
│   ├── geometry/              # (9 файлов: Section, Mode, Simple/Extended/Advanced)
│   ├── layout/                # (4 файла: LeftSidebar, RightSidebar, Settings)
│   ├── objects/               # (5 файлов: Card, Selector, List, CreateModal, index)
│   ├── projects/              # (5 файлов: List, Modal, DataMgmt, Create, index)
│   ├── rooms/                 # (3 файла: List, ListItem, index)
│   ├── works/                 # (11 файлов: WorkList, Materials, PriceSearch, index)
│   ├── summary/               # (4 файла: Materials, Tools, Works, index)
│   ├── ui/                    # (3 файла: ConfirmDialog, ErrorBoundary, NumberInput)
│   ├── BackupManager.tsx      # (~837 строк)
│   ├── RoomEditor.tsx         # (~906 строк)
│   └── SummaryView.tsx
│
├── contexts/                  # (4 файла)
│   ├── AuthContext.tsx         # JWT authentication
│   ├── ProjectContext.tsx      # Project state (~981 строка)
│   ├── WorkTemplateContext.tsx # Work templates
│   └── index.ts
│
├── types/                     # (5 файлов)
│   ├── index.ts               # Main types (ProjectData, ObjectData, RoomData...)
│   ├── auth.ts
│   ├── storage.ts
│   ├── workTemplate.ts
│   └── vite-env.d.ts
│
├── hooks/                     # (4 файла)
│   ├── useGeometryState.ts
│   ├── useMaterialCalculation.ts
│   ├── useProjects.ts         # (legacy — дублирует ProjectContext)
│   └── useWorkTemplates.ts
│
├── data/                      # (2 файла)
│   ├── initialData.ts
│   └── workTemplatesCatalog.ts
│
└── utils/                     # (17 файлов)
    ├── costs.ts, geometry.ts, factories.ts
    ├── logger.ts, debugLogger.ts
    ├── storage.ts, idMapper.ts, saveQueue.ts
    ├── projectObjects.ts, projectContextPatch.ts, migration.ts
    ├── roomHelpers.ts, materialCalculations.ts
    ├── format.ts, localStorageProvider.ts, templateStorage.ts
    └── geometry.test.ts
```

### Data Hierarchy

```
User → Project → Object → Room → Work → Material/Tool
```

### Geometry Modes

| Mode | Description | Key Features |
|------|-------------|--------------|
| **Simple** | Single rectangular room | Basic length x width, windows, doors |
| **Extended** | Multiple subsections | Different shapes per subsection |
| **Advanced** | Professional mode | Segments, obstacles, wall height variations |

---

## Development

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
npm run lint         # TypeScript type check + ESLint
```

### Environment
- **Frontend port:** 3993
- **Backend port:** 3994
- **Env File:** `.env.local` with `VITE_GEMINI_API_KEY=your_key`

---

## Dependencies

### Production (Frontend)
| Package | Version | Purpose |
|---------|---------|---------|
| react, react-dom | ^19.0.0 | UI framework |
| lucide-react | ^0.546.0 | Icons |
| @dnd-kit/* | ^6.3+ | Drag-and-drop |
| tailwindcss | ^4.1.14 | Styling |
| vite | ^6.2.0 | Build tool |

### Production (Backend)
| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.21.0 | HTTP server |
| mysql2 | ^3.11.0 | MySQL driver |
| knex | ^3.1.0 | Query builder / migrations |
| jsonwebtoken | ^9.0.2 | JWT auth |
| winston | ^3.17.0 | Logging |
| zod | ^3.23.0 | Validation |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ~5.8.2 | Type checking |
| vitest | ^4.0.18 | Unit testing |
| @playwright/test | ^1.58.2 | E2E testing |
| eslint | ^10.2.0 | Linting |

---

## Testing

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

### E2E Status (2026-04-17)
All `test.describe.skip` removed. Tests use unified fixtures with API mocks via `page.route()`.
- auth.spec.ts — 3/3
- objects.spec.ts — 4/4
- export-import.spec.ts — restored
- All other specs — restored with `data-testid` selectors

---

## Documentation

| Document | Description |
|----------|-------------|
| [../INDEX.md](../INDEX.md) | Главный индекс (наиболее актуальный) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура проекта |
| [TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md) | ТЗ v1.1 |
| [TODO.md](./TODO.md) | Рабочий бэклог |
| [PROGRESS.md](./PROGRESS.md) | История прогресса |
| [FRONTEND-STATUS.md](./FRONTEND-STATUS.md) | Статус Frontend |
| [CODE_REVIEW.md](./CODE_REVIEW.md) | Код-ревью v5.1 |
| [LOGGING.md](./LOGGING.md) | Руководство по логированию |
| [README.md](./README.md) | Индекс документации |

---

## Notes for AI Agents

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
