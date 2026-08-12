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
  length: number;
  width: number;
  base1?: number;
  base2?: number;
  depth?: number;
  side1?: number;
  side2?: number;
  sideA?: number;
  sideB?: number;
  sideC?: number;
  base?: number;
  side?: number;
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

export type Material = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  coveragePerUnit?: number;
  consumptionRate?: number;
  layers?: number;
  piecesPerUnit?: number;
  wastePercent?: number;
  packageSize?: number;
  isPerimeter?: boolean;
  multiplier?: number;
  calculatedQty?: number;
  autoCalcEnabled?: boolean;
};

export type Tool = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isRent: boolean;
  rentPeriod?: number;
};

export type WorkData = {
  id: string;
  name: string;
  unit: string;
  enabled: boolean;
  workUnitPrice: number;
  materialPriceType?: 'per_unit' | 'total';
  materialPrice?: number;
  materials?: Material[];
  tools?: Tool[];
  count?: number;
  calculationType: CalculationType;
  isCustom?: boolean;
  useManualQty?: boolean;
  manualQty?: number;
  catalogId?: string;
  templateId?: string;
  templateCreatedAt?: string;
  category?: string;
  sourceVolume?: number;
};

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
  simpleModeData?: SimpleModeData;
  extendedModeData?: ExtendedModeData;
  advancedModeData?: AdvancedModeData;
  objectId?: string;
};

export type ObjectData = {
  id: string;
  projectId: string;
  name: string;
  city?: string;
  address?: string;
  useAiPricing?: boolean;
  lastAiPriceUpdate?: string;
  rooms: RoomData[];
  version?: number;
  sortOrder?: number;
};

export type ProjectData = {
  id: string;
  name: string;
  description?: string;
  isPremium?: boolean;
  objects: ObjectData[];
  city?: string;
  useAiPricing?: boolean;
  lastAiPriceUpdate?: string;
  version?: number;
  rooms?: RoomData[];
};
