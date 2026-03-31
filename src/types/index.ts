// Geometry types
export type Opening = {
  id: string;
  width: number;
  height: number;
  comment?: string;
};

export type CalculationType = 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';

export type GeometryMode = 'simple' | 'extended' | 'advanced';

export type SectionShape = 'rectangle' | 'trapezoid' | 'triangle' | 'parallelogram';

export type RoomSubSection = {
  id: string;
  name: string;
  shape: SectionShape;
  // Rectangle: length × width
  length: number;
  width: number;
  // Trapezoid: base1, base2, depth, side1, side2
  base1?: number;
  base2?: number;
  depth?: number;
  side1?: number;
  side2?: number;
  // Triangle: sideA, sideB, sideC
  sideA?: number;
  sideB?: number;
  sideC?: number;
  // Parallelogram: base, depth, side
  base?: number;
  side?: number;
  // Openings
  windows: Opening[];
  doors: Opening[];
};

export type RoomSegment = {
  id: string;
  name: string;
  length: number;
  width: number;
  operation: 'add' | 'subtract';
};

export type ObstacleType = 'column' | 'duct' | 'niche' | 'other';

export type Obstacle = {
  id: string;
  name: string;
  type: ObstacleType;
  area: number;
  perimeter: number;
  operation: 'add' | 'subtract';
};

export type WallSection = {
  id: string;
  name: string;
  length: number;
  height: number;
};

// Materials and tools
export type Material = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;

  // Параметры для расчёта (опционально)
  coveragePerUnit?: number;     // м² в упаковке/рулоне
  consumptionRate?: number;      // расход на м² (л/м², кг/м², шт/м²)
  layers?: number;               // количество слоёв (для краски)
  piecesPerUnit?: number;        // штук в упаковке (саморезы)
  wastePercent?: number;         // запас на подрезку %
  packageSize?: number;          // размер упаковки (л, кг) для подбора
  isPerimeter?: boolean;         // расчёт по периметру
  multiplier?: number;           // множитель для периметра/количества

  // Вычисляемые
  calculatedQty?: number;        // рекомендованное количество
  autoCalcEnabled?: boolean;     // использовать авторасчёт
};

export type Tool = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isRent: boolean;
  rentPeriod?: number;
};

// Work data
export type WorkData = {
  id: string;
  name: string;
  unit: string;
  enabled: boolean;
  workUnitPrice: number;
  // Legacy fields (for backward compatibility)
  materialPriceType?: 'per_unit' | 'total';
  materialPrice?: number;
  // New fields
  materials?: Material[];
  tools?: Tool[];
  count?: number;
  calculationType: CalculationType;
  isCustom?: boolean;
  // Manual quantity override
  useManualQty?: boolean;
  manualQty?: number;
};

// Mode-specific data storage
export type SimpleModeData = {
  length: number;
  width: number;
  windows: Opening[];
  doors: Opening[];
};

export type ExtendedModeData = {
  subSections: RoomSubSection[];
};

export type AdvancedModeData = {
  segments: RoomSegment[];
  obstacles: Obstacle[];
  wallSections: WallSection[];
};

// Room data
export type RoomData = {
  id: string;
  name: string;
  geometryMode: GeometryMode;
  length: number;
  width: number;
  height: number;
  segments: RoomSegment[];
  obstacles: Obstacle[];
  wallSections: WallSection[];
  subSections: RoomSubSection[];
  windows: Opening[];
  doors: Opening[];
  works: WorkData[];
  // Mode-specific data storage
  simpleModeData?: SimpleModeData;
  extendedModeData?: ExtendedModeData;
  advancedModeData?: AdvancedModeData;
};

// Object data (new - недвижимость в составе проекта)
export type ObjectData = {
  id: string;
  projectId: string;          // Ссылка на проект
  name: string;
  city?: string;
  address?: string;
  useAiPricing?: boolean;
  lastAiPriceUpdate?: string;
  rooms: RoomData[];
  version?: number;
  sortOrder?: number;
};

// Project data (обновлено для поддержки объектов)
export type ProjectData = {
  id: string;
  name: string;
  description?: string;
  isPremium?: boolean;
  objects: ObjectData[];      // Новый уровень: объекты
  // Дополнительно
  city?: string;                // Город для поиска цен (deprecated)
  useAiPricing?: boolean;       // Использовать ИИ для цен (deprecated)
  lastAiPriceUpdate?: string;   // Дата последнего обновления цен через ИИ (deprecated)
  version?: number;             // Версия для оптимистичной блокировки
  // Для обратной совместимости (старые проекты)
  rooms?: RoomData[];           // deprecated - будет перенесено в objects[0].rooms
};

// Room metrics (calculated)
export type RoomMetrics = {
  floorArea: number;
  perimeter: number;
  grossWallArea: number;
  windowsArea: number;
  doorsArea: number;
  netWallArea: number;
  skirtingLength: number;
  volume: number;
};

// Work costs (calculated)
export type WorkCosts = {
  work: number;
  material: number;
  tools: number;
  total: number;
};

export type RoomCosts = {
  costs: Record<string, WorkCosts>;
  totalWork: number;
  totalMaterial: number;
  totalTools: number;
  total: number;
};