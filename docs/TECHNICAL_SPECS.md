# Technical Specifications for AI Parsers

**Last Updated:** 2026-03-12  
**Document Purpose:** Technical reference for third-party AI agents to write parsers, scrapers, and integrations

---

## Application Overview

| Property | Value |
|----------|-------|
| **Name** | Мой ремонт (Repair Calculator) |
| **Type** | Single-page React web application |
| **Purpose** | Renovation cost estimation with room geometry calculations |
| **Development URL** | `http://localhost:3993` |
| **Production Build** | `dist/` directory (static files) |

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 19.0.0 |
| Language | TypeScript | 5.8.2 |
| Build Tool | Vite | 6.2.0 |
| Styling | Tailwind CSS | 4.1.14 |
| Icons | Lucide React | 0.546.0 |
| Drag & Drop | @dnd-kit/core | 6.3.1 |
| Testing (Unit) | Vitest | 4.0.18 |
| Testing (E2E) | Playwright | 1.58.2 |
| Animations | Motion | 12.23.24 |

---

## Data Storage

### Primary Storage
- **Mechanism:** `localStorage` (browser)
- **Key:** `repair-calc-projects`
- **Auto-save:** 1 second debounce after changes
- **Persistence:** Data survives page refresh and browser restart

### Export Formats
| Format | Purpose | Location |
|--------|---------|----------|
| **JSON** | Full backup/restore | UI → "Данные" → "Сохранить бэкап (JSON)" |
| **CSV** | Excel export | UI → "Данные" → "Экспорт в Excel (CSV)" |

### Storage Structure
```javascript
// localStorage.getItem('repair-calc-projects')
{
  "projects": [ProjectData, ...],
  "currentProjectId": "string | null",
  "currentRoomId": "string | null"
}
```

---

## Data Models (TypeScript Interfaces)

### ProjectData
```typescript
{
  id: string;                    // UUID v4
  name: string;                  // User-defined project name
  rooms: RoomData[];             // Array of rooms
  city?: string;                 // City for price lookup
  useAiPricing?: boolean;        // Enable AI-based pricing
  lastAiPriceUpdate?: string;    // ISO 8601 date
}
```

### RoomData
```typescript
{
  id: string;                    // UUID v4
  name: string;                  // Room name (e.g., "Кухня")
  geometryMode: 'simple' | 'extended' | 'advanced';
  length: number;                // meters
  width: number;                 // meters
  height: number;                // meters
  windows: Opening[];
  doors: Opening[];
  works: WorkData[];
  segments: RoomSegment[];       // Advanced mode
  obstacles: Obstacle[];         // Advanced mode
  wallSections: WallSection[];   // Advanced mode
  subSections: RoomSubSection[]; // Extended mode
  simpleModeData?: SimpleModeData;
  extendedModeData?: ExtendedModeData;
  advancedModeData?: AdvancedModeData;
}
```

### Opening (Windows/Doors)
```typescript
{
  id: string;
  width: number;                 // meters
  height: number;                // meters
  comment?: string;
}
```

### WorkData
```typescript
{
  id: string;
  name: string;                  // Work name (e.g., "Штукатурка стен")
  unit: string;                  // Unit (м², м.п., шт)
  enabled: boolean;
  workUnitPrice: number;         // RUB per unit
  calculationType: 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';
  isCustom?: boolean;
  count?: number;                // For customCount type
  useManualQty?: boolean;
  manualQty?: number;
  materials: Material[];         // Multiple materials support
  tools: Tool[];
  // Legacy fields (backward compatibility)
  materialPriceType?: 'per_unit' | 'total';
  materialPrice?: number;
}
```

### Material
```typescript
{
  id: string;
  name: string;                  // Material name
  quantity: number;              // Amount needed
  unit: string;                  // Unit (кг, л, шт, м², м.п.)
  pricePerUnit: number;          // RUB per unit
  coveragePerUnit?: number;      // m² per package/roll
  consumptionRate?: number;      // Consumption per m² (л/м², кг/м²)
  layers?: number;               // Number of coats (for paint)
  piecesPerUnit?: number;        // Pieces per package
  wastePercent?: number;         // Waste allowance (%)
  packageSize?: number;          // Package size (л, кг)
  isPerimeter?: boolean;         // Calculate by perimeter
  multiplier?: number;           // Multiplier for quantity
  calculatedQty?: number;        // Auto-calculated quantity
  autoCalcEnabled?: boolean;     // Enable auto-calculation
}
```

### Tool
```typescript
{
  id: string;
  name: string;                  // Tool name
  quantity: number;
  price: number;                 // RUB
  isRent: boolean;               // Rental or purchase
  rentPeriod?: number;           // Rental period (days)
}
```

### RoomSegment (Advanced Mode)
```typescript
{
  id: string;
  name: string;
  length: number;                // meters
  width: number;                 // meters
  operation: 'add' | 'subtract'; // Add or subtract area
}
```

### Obstacle (Advanced Mode)
```typescript
{
  id: string;
  name: string;
  type: 'column' | 'duct' | 'niche' | 'other';
  area: number;                  // m²
  perimeter: number;             // meters
  operation: 'add' | 'subtract';
}
```

### WallSection (Advanced Mode)
```typescript
{
  id: string;
  name: string;
  length: number;                // meters
  height: number;                // meters (can differ from room height)
}
```

### RoomSubSection (Extended Mode)
```typescript
{
  id: string;
  name: string;
  shape: 'rectangle' | 'trapezoid' | 'triangle' | 'parallelogram';
  length: number;
  width: number;
  base1?: number;                // Trapezoid
  base2?: number;                // Trapezoid
  depth?: number;                // Trapezoid/Parallelogram
  side1?: number;                // Trapezoid
  side2?: number;                // Trapezoid
  sideA?: number;                // Triangle
  sideB?: number;                // Triangle
  sideC?: number;                // Triangle
  base?: number;                 // Parallelogram
  side?: number;                 // Parallelogram
  windows: Opening[];
  doors: Opening[];
}
```

---

## Calculation Types

| Type | Formula | Applied To |
|------|---------|------------|
| `floorArea` | length × width | Flooring, ceiling works |
| `netWallArea` | (perimeter × height) − windows − doors | Painting, wallpaper, plaster |
| `skirtingLength` | perimeter − door widths | Baseboards |
| `customCount` | manual count | Electrical points, fixtures |

### Room Metrics (Calculated)
```typescript
{
  floorArea: number;      // m²
  perimeter: number;      // meters
  grossWallArea: number;  // m² (before openings)
  windowsArea: number;    // m²
  doorsArea: number;      // m²
  netWallArea: number;    // m² (after openings)
  skirtingLength: number; // meters
  volume: number;         // m³
}
```

### Cost Calculation
```typescript
{
  work: number;           // workUnitPrice × quantity
  material: number;       // Σ(material.quantity × material.pricePerUnit)
  tools: number;          // Σ(tool.quantity × tool.price) [× rentPeriod if rental]
  total: number;          // work + material + tools
}
```

---

## Geometry Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `simple` | Single rectangular room | Standard rooms |
| `extended` | Multiple subsections with different shapes | L-shaped, complex rooms |
| `advanced` | Professional mode with segments and obstacles | Rooms with niches, columns, varying heights |

---

## File Structure

```
repair-calc/
├── src/
│   ├── App.tsx                  # Main component (~3000 lines)
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Global styles + Tailwind
│   ├── types/
│   │   ├── index.ts             # Core TypeScript interfaces
│   │   ├── storage.ts           # Storage provider interface
│   │   └── workTemplate.ts      # Work template types
│   ├── components/
│   │   ├── rooms/               # Room management UI
│   │   ├── works/               # Work calculation UI
│   │   ├── geometry/            # Geometry mode components
│   │   ├── summary/             # Summary view components
│   │   ├── ui/                  # Reusable UI components
│   │   ├── BackupManager.tsx    # Export/import functionality
│   │   ├── RoomEditor.tsx       # Room editor component
│   │   └── SummaryView.tsx      # Project summary view
│   ├── hooks/
│   │   └── useProjects.ts       # Project persistence hook
│   ├── utils/
│   │   └── storage.ts           # localStorage wrapper
│   ├── api/
│   │   └── prices/
│   │       ├── geminiPriceSearch.ts  # AI pricing via Gemini
│   │       ├── index.ts
│   │       ├── priceCache.ts
│   │       └── types.ts
│   └── data/
│       ├── initialData.ts       # Initial project data
│       └── workTemplatesCatalog.ts  # Work templates
├── tests/                       # Playwright e2e tests
├── e2e/                         # Additional e2e tests
├── docs/                        # Documentation
├── dist/                        # Production build output
├── index.html                   # HTML entry point
├── package.json                 # Dependencies and scripts
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── vitest.config.ts             # Vitest configuration
├── playwright.config.ts         # Playwright configuration
└── .env.example                 # Environment variables template
```

---

## API Endpoints

### AI Pricing Service
- **Module:** `src/api/prices/geminiPriceSearch.ts`
- **Provider:** Google Gemini AI (`@google/genai`)
- **Environment:** `GEMINI_API_KEY`
- **Purpose:** Search and update work/material prices via AI

---

## Commands

```bash
npm run dev           # Start dev server (port 3993)
npm run build         # Production build → dist/
npm run preview       # Preview production build
npm test              # Run Vitest unit tests
npm run test:e2e      # Run Playwright e2e tests (headless)
npm run test:e2e:ui   # Run Playwright e2e tests (UI mode)
npm run lint          # TypeScript type check
```

---

## Environment Variables

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `GEMINI_API_KEY` | Google Gemini AI API key | No | - |
| `MISTRAL_API_KEY` | Mistral AI API key | No | - |
| `SERVER_PORT` | Backend API port | No | 3994 |
| `APP_URL` | Application URL | No | http://localhost:3993 |
| `DISABLE_HMR` | Disable hot module reload | No | false |

---

## DOM Selectors for Parsers

### Key Elements
| Element | Selector/Description |
|---------|---------------------|
| Root container | `#root` |
| Navigation | `.room-list`, `.project-item` |
| Work items | `.work-list`, `.work-item` |
| Backup manager | `.backup-manager` |
| Room editor | `.room-editor` |
| Summary view | `.summary-view` |

### Icons
- All icons use **Lucide React** library
- Icons are SVG elements with `lucide-` class prefixes

### Data Attributes
- Look for `data-room-id`, `data-work-id`, `data-project-id` attributes
- Geometry modes indicated by `data-geometry-mode`

---

## Important Notes for Parser Development

### Port Configuration
- **Development:** Port **3993** (hardcoded in `package.json` and `vite.config.ts`)
- **Production:** Static files served from `dist/`

### Hot Module Reload (HMR)
- HMR may be disabled via `DISABLE_HMR=true` environment variable
- In AI Studio environments, HMR is typically disabled

### Data Migration
- Legacy `materialPrice` field is migrated to `materials[]` array
- Backward compatibility maintained via `migrateWorkData()` function

### Rate Limiting
- Auto-save occurs 1 second after last change (debounced)
- No server-side rate limiting (localStorage-based)

### Browser Compatibility
- Modern browsers with localStorage support
- No server-side rendering (client-side React SPA)

---

## Integration Examples

### Reading Data from localStorage
```javascript
const data = JSON.parse(localStorage.getItem('repair-calc-projects'));
const projects = data.projects;
const currentProject = projects.find(p => p.id === data.currentProjectId);
```

### Exporting Data Programmatically
```javascript
// Trigger JSON export
const exportData = JSON.parse(localStorage.getItem('repair-calc-projects'));
const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
const url = URL.createObjectURL(blob);
// Download via anchor element
```

### Parsing CSV Export
```javascript
// CSV format: Room,Work,Unit,Quantity,Price,Total,Materials,Tools
const csvData = await fetch('/export.csv').then(r => r.text());
const rows = csvData.split('\n').map(row => row.split(','));
```

---

## Contact & Support

For questions about integration, refer to:
- **Main Documentation:** `README.md`
- **Application Index:** `docs/INDEX.md`
- **Code Review:** `docs/CODE_REVIEW.md`
- **Architecture:** `docs/ARCHITECTURE.md`

---

**End of Technical Specifications**
