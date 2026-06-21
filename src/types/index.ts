export type {
  Opening,
  CalculationType,
  GeometryMode,
  SectionShape,
  RoomSubSection,
  RoomSegment,
  ObstacleType,
  Obstacle,
  WallSection,
  Material,
  Tool,
  WorkData,
  SimpleModeData,
  ExtendedModeData,
  AdvancedModeData,
  RoomData,
  ObjectData,
  ProjectData,
} from '@shared/types';

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
