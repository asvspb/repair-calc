# Application Index - Repair Calculator

**Last Updated:** 2026-03-13
**Application Name:** Мой ремонт (Repair Calculator)
**Version:** 0.0.0

---

## 📋 Quick Overview

**Purpose:** Web application for calculating renovation/repair costs for rooms with detailed breakdown of works and materials.

**Tech Stack:**
- **Frontend:** React 19 + TypeScript + Vite 6
- **Styling:** Tailwind CSS 4
- **State Management:** React Context + localStorage
- **Testing:** Vitest (unit), Playwright (e2e) — 402 теста
- **Icons:** Lucide React

**Key Features:**
- Multi-room project management
- Three geometry modes: Simple, Extended (multi-section), Advanced (professional)
- Automatic cost calculation (works + materials + tools)
- Auto-save to localStorage
- JSON backup/restore
- CSV export for Excel
- AI price search via Gemini API

---

## 🏗️ Architecture

### Entry Points
- `index.html` - HTML entry point
- `src/main.tsx` - React app bootstrap
- `src/App.tsx` - Main application component (~170 lines) ✅ Декомпозирован

### Core Structure
```
src/
├── App.tsx                    # Main app: routing, composition (~170 lines)
├── main.tsx                   # React root
├── index.css                  # TailwindCSS
│
├── api/prices/                # AI price search
│   ├── geminiPriceSearch.ts
│   ├── mistralPriceSearch.ts
│   ├── priceCache.ts
│   ├── unifiedSearch.ts
│   └── types.ts
│
├── components/
│   ├── geometry/              # Geometry module (8 files)
│   │   ├── GeometrySection.tsx
│   │   ├── ModeSelector.tsx
│   │   ├── SimpleGeometry.tsx
│   │   ├── ExtendedGeometry.tsx
│   │   ├── AdvancedGeometry.tsx
│   │   ├── SubSectionItem.tsx
│   │   ├── OpeningList.tsx
│   │   └── GeometryMetrics.tsx
│   ├── rooms/                 # Room list (3 files)
│   │   ├── RoomList.tsx
│   │   └── RoomListItem.tsx
│   ├── works/                 # Works and materials (10 files)
│   │   ├── WorkList.tsx
│   │   ├── WorkListItem.tsx
│   │   ├── WorkCatalogPicker.tsx
│   │   ├── MaterialCalculationCard.tsx
│   │   ├── PaintMaterialCard.tsx
│   │   └── TileMaterialCard.tsx
│   ├── summary/               # Summary views (4 files)
│   │   ├── SummaryMaterials.tsx
│   │   ├── SummaryTools.tsx
│   │   └── SummaryWorks.tsx
│   ├── ui/                    # UI components (3 files)
│   │   ├── ConfirmDialog.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── NumberInput.tsx
│   ├── BackupManager.tsx
│   ├── RoomEditor.tsx         # Room editor (~843 lines)
│   └── SummaryView.tsx
│
├── contexts/
│   ├── ProjectContext.tsx     # Project state + persistence
│   └── WorkTemplateContext.tsx
│
├── data/
│   ├── initialData.ts         # Initial project data
│   └── workTemplatesCatalog.ts # Work catalog (19 items)
│
├── hooks/
│   ├── useGeometryState.ts    # Geometry state management
│   ├── useMaterialCalculation.ts
│   ├── useProjects.ts
│   └── useWorkTemplates.ts
│
├── types/
│   ├── index.ts               # Main types (ProjectData, RoomData, WorkData...)
│   ├── storage.ts             # IStorageProvider interface
│   └── workTemplate.ts        # Work templates
│
└── utils/
    ├── costs.ts               # Cost calculations
    ├── factories.ts           # Entity factories
    ├── geometry.ts            # Geometry calculations
    ├── localStorageProvider.ts
    ├── materialCalculations.ts # Material formulas
    ├── roomHelpers.ts         # Room helpers
    ├── storage.ts             # StorageManager
    └── templateStorage.ts     # Template storage
```

### Data Model (TypeScript Types)

**ProjectData:**
```typescript
{
  id: string
  name: string
  rooms: RoomData[]
  city?: string              // City for price search
  useAiPricing?: boolean     // Use AI for prices
  lastAiPriceUpdate?: string
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

**WorkData:**
```typescript
{
  id: string
  name: string
  unit: string
  enabled: boolean
  workUnitPrice: number
  calculationType: 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount'
  materials?: Material[]
  tools?: Tool[]
  isCustom?: boolean
  useManualQty?: boolean
  manualQty?: number
}
```

**Material:**
```typescript
{
  id: string
  name: string
  quantity: number
  unit: string
  pricePerUnit: number
  coveragePerUnit?: number
  consumptionRate?: number
  layers?: number
  wastePercent?: number
  autoCalcEnabled?: boolean
}
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

### Current (localStorage)
- **Primary:** localStorage (browser)
- **Auto-save:** 1 second debounce
- **Abstraction:** `IStorageProvider` interface

### Planned (MySQL)
- **Server:** Express + MySQL
- **Auth:** JWT
- **Sync:** Offline-first with IndexedDB queue

**See:** [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)

---

## 🧪 Testing

### Test Statistics
| Category | Count |
|----------|-------|
| Unit tests (utils) | 220 |
| Unit tests (hooks) | 72 |
| Integration tests | 7 |
| API tests | 22 |
| E2E tests | 16 |
| **Total** | **402** |

### Coverage: ~50%

---

## 📂 Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app composition (~170 lines) |
| `src/components/RoomEditor.tsx` | Room editor (~843 lines) |
| `src/contexts/ProjectContext.tsx` | Project state management |
| `src/utils/geometry.ts` | Geometry calculations |
| `src/utils/costs.ts` | Cost calculations |
| `src/types/index.ts` | Type definitions |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [TODO.md](./TODO.md) | Current tasks and progress |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Project architecture |
| [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) | DB migration spec |
| [CODE_REVIEW.md](./CODE_REVIEW.md) | Code review results |
| [PROGRESS.md](./PROGRESS.md) | Progress history |
| [MATERIALS_CATALOG_FEATURE.md](./MATERIALS_CATALOG_FEATURE.md) | Materials catalog spec |

---

## 🚨 Notes for AI Agents

### Before Making Changes
1. Read this index to understand current state
2. Check `docs/TODO.md` for current tasks
3. Check `docs/DATABASE_MIGRATION.md` for DB migration plan

### After Making Changes
1. Update relevant documentation
2. Run tests: `npm test`
3. Update this index if structure changed

---

**End of Index**