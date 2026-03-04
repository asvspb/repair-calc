# Application Index - Repair Calculator

**Last Updated:** 2026-03-04
**Application Name:** Мой ремонт (Repair Calculator)
**Version:** 0.0.0

---

## 📋 Quick Overview

**Purpose:** Web application for calculating renovation/repair costs for rooms with detailed breakdown of works and materials.

**Tech Stack:**
- **Frontend:** React 19 + TypeScript + Vite 6
- **Styling:** Tailwind CSS 4
- **State Management:** localStorage (no external state library)
- **Testing:** Vitest (unit), Playwright (e2e)
- **Icons:** Lucide React

**Key Features:**
- Multi-room project management
- Three geometry modes: Simple, Extended (multi-section), Advanced (professional)
- Automatic cost calculation (works + materials + tools)
- Auto-save to localStorage
- JSON backup/restore
- CSV export for Excel
- Gemini AI integration (via `@google/genai`)

---

## 🏗️ Architecture

### Entry Points
- `index.html` - HTML entry point
- `src/main.tsx` - React app bootstrap
- `src/App.tsx` - Main application component (~3000 lines) ⚠️ Требует декомпозиции (см. [CODE_REVIEW.md](./CODE_REVIEW.md))

### Core Structure
```
src/
├── App.tsx              # Main app: state, calculations, navigation
├── main.tsx             # React root
├── index.css            # Global styles + Tailwind
├── components/
│   ├── rooms/           # Room-related UI components
│   ├── works/           # Work calculation components
│   └── BackupManager.tsx # Data export/import
├── hooks/
│   └── useProjects.ts   # Project persistence hook
└── utils/
    └── storage.ts       # localStorage wrapper
```

### Data Model (TypeScript Types)

**ProjectData:**
```typescript
{
  id: string
  name: string
  rooms: RoomData[]
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
  wallSections: WallSection[]    // Advanced mode (height variations)
  subSections: RoomSubSection[]  // Extended mode (multi-shape)
  // Mode-specific data storage
  simpleModeData?: SimpleModeData
  extendedModeData?: ExtendedModeData
  advancedModeData?: AdvancedModeData
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
  isCustom?: boolean
  count?: number                 // For customCount type
  useManualQty?: boolean
  manualQty?: number
  materials: Material[]          // Multiple materials support
  tools: Tool[]                  // Tools (rental or purchase)
  // Legacy fields for backward compatibility
  materialPriceType?: 'per_unit' | 'total'
  materialPrice?: number
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
}
```

**Tool:**
```typescript
{
  id: string
  name: string
  quantity: number
  price: number
  isRent: boolean
  rentPeriod?: number
}
```

### Geometry Modes

| Mode | Description | Key Features |
|------|-------------|--------------|
| **Simple** | Single rectangular room | Basic length×width, windows, doors |
| **Extended** | Multiple subsections | Different shapes (rectangle, trapezoid, triangle, parallelogram) per subsection |
| **Advanced** | Professional mode | Add/subtract segments, obstacles (columns, ducts), wall height variations |

### Calculation Logic

**Metrics** (calculated in `calculateRoomMetrics()`):
- `floorArea` - Total floor area (m²)
- `perimeter` - Room perimeter (m)
- `grossWallArea` - Gross wall area (m²)
- `netWallArea` - Wall area minus openings (m²)
- `skirtingLength` - Perimeter minus door widths (m)
- `volume` - Room volume (m³)

**Costs** (calculated in `calculateRoomCosts()`):
- Work cost = quantity × workUnitPrice
- Material cost = Σ(quantity × pricePerUnit) for all materials
- Tool cost = Σ(quantity × price) [× rentPeriod if rental]
- Total = work + material + tools

---

## 🔧 Key Components

### App.tsx
- **State:** `projects`, `currentProjectId`, `currentRoomId`, `view`
- **Views:** `summary`, `room`, `projects`
- **Functions:** `createNewProject()`, `createNewRoom()`, `calculateRoomMetrics()`, `calculateRoomCosts()`
- **Migration:** `migrateWorkData()` for backward compatibility

### Components
- `RoomList` - Project/room navigation
- `WorkList` - Work items management
- `BackupManager` - JSON backup/restore, CSV export

### Hooks
- `useProjects` - Project persistence to localStorage

### Utils
- `storage.ts` - localStorage wrapper with auto-save (1s debounce)

---

## 🚀 Development

### Prerequisites
- Node.js 18+

### Commands
```bash
npm install          # Install dependencies
npm run dev          # Dev server on port 3993
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm test             # Run Vitest tests
npm run test:e2e     # Run Playwright e2e tests
npm run lint         # TypeScript type check
```

### Environment
- **Port:** 3993 (hardcoded in package.json and vite.config.ts)
- **Env File:** `.env.local` with `GEMINI_API_KEY=your_key`

### Important Rules (from README)
1. **Stop dev server** before making code changes (`Ctrl+C`)
2. **Port 3993 only** - application works ONLY on this port
3. **Test after every change:**
   - `npm test` - unit tests
   - `npm run lint` - type check
   - `npm run dev` - verify in browser

---

## 📦 Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| react, react-dom | ^19.0.0 | UI framework |
| lucide-react | ^0.546.0 | Icons |
| @dnd-kit/* | ^6.3+ | Drag-and-drop |
| @google/genai | ^1.29.0 | AI integration |
| tailwindcss | ^4.1.14 | Styling |
| vite | ^6.2.0 | Build tool |
| express | ^4.21.2 | (Possibly for API) |
| better-sqlite3 | ^12.4.1 | (Possibly for backend) |
| motion | ^12.23.24 | Animations |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ~5.8.2 | Type checking |
| vitest | ^4.0.18 | Unit testing |
| @playwright/test | ^1.58.2 | E2E testing |
| @testing-library/react | ^16.3.2 | React testing |
| jsdom | ^28.1.0 | Test DOM environment |

---

## 🗄️ Data Persistence

### Storage Strategy
- **Primary:** localStorage (browser)
- **Auto-save:** 1 second debounce after changes
- **Backup:** JSON export/import via UI
- **Migration:** `migrateWorkData()` handles legacy materialPrice → materials array

### Data Flow
```
User Action → State Update → StorageManager.save() → localStorage
                                      ↓
                              (1s debounce)
```

### Backup/Restore
- **Location:** `BackupManager.tsx`
- **Formats:** JSON (full backup), CSV (Excel export)
- **UI:** "Данные" button → backup options

---

## 🧪 Testing

### Test Structure
- `tests/` - E2E tests (Playwright)
- `src/tests/` - Unit tests (Vitest)
- `e2e/` - Additional e2e tests

### Test Commands
```bash
npm test              # Unit tests
npm run test:e2e      # E2E tests (headless)
npm run test:e2e:ui   # E2E tests (UI mode)
```

---

## 📝 File Conventions

### TypeScript
- Strict mode enabled
- Path alias: `@` → root directory

### Styling
- Tailwind CSS 4 (via Vite plugin)
- Utility-first approach
- Responsive design (mobile + desktop)

### Component Structure
- TypeScript interfaces at top of files
- Custom hooks in `hooks/` directory
- Reusable components in `components/` directory

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Optional | Google Gemini AI API key |

---

## 🚨 Important Notes for AI Agents

### ⚠️ CRITICAL: Always Update This Index

**When making ANY changes to the application, you MUST update this index file to reflect the changes.**

This includes:
- New files/directories added
- Files deleted or renamed
- New dependencies added/removed
- Changes to data models (types/interfaces)
- New features or components
- Changes to calculation logic
- Changes to file structure
- Changes to commands or configuration

**Why:** This index serves as the single source of truth for understanding the application. Outdated information will cause confusion and errors in future sessions.

### Before Making Changes
1. Read this index to understand current state
2. Plan changes based on existing architecture
3. Follow existing conventions (naming, structure, patterns)

### After Making Changes
1. Update relevant sections in this index
2. Verify all references are accurate
3. Mark the update date at the top

### Docker Note
- Docker configs moved to `.docker/` (archived)
- Development uses Node.js directly (no Docker)

---

## 📂 Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app logic, calculations, state (~3000 lines) |
| `src/main.tsx` | React entry point |
| `package.json` | Dependencies, scripts, port config |
| `vite.config.ts` | Vite + Tailwind + React plugins, port 3993 |
| `tsconfig.json` | TypeScript configuration |
| `vitest.config.ts` | Unit test config |
| `playwright.config.ts` | E2E test config |
| `README.md` | User documentation, dev rules |
| `.env.example` | Environment template |
| `docs/CODE_REVIEW.md` | Код-ревью и план улучшений |
| `docs/ARCHITECTURE.md` | Архитектурный план (backend + AI + PWA) |
| `docs/TODO.md` | Список задач и замечаний |

---

## 🎯 Quick Start Checklist

For new AI agents joining the project:

- [ ] Read this index file
- [ ] Read `README.md` for development rules
- [ ] Check `package.json` for dependencies and scripts
- [ ] Review `src/App.tsx` for main logic
- [ ] Understand data types in `App.tsx` (RoomData, WorkData, etc.)
- [ ] Note the port: **3993**
- [ ] Remember: Stop server before code changes
- [ ] Test after every change (tests + lint + browser)

---

**End of Index**
