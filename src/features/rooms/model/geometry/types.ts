import type {
  Opening,
  RoomSubSection,
  RoomSegment,
  Obstacle,
  WallSection,
  GeometryMode,
} from '@shared/types';

export interface UseGeometryStateReturn {
  // UI State
  isGeometryCollapsed: boolean;
  isExtendedGeometryCollapsed: boolean;
  subSectionsExpanded: boolean;

  // UI Handlers
  toggleGeometryCollapse: () => void;
  toggleExtendedGeometryCollapse: () => void;
  toggleSubSectionsExpand: () => void;

  // Mode switching
  handleGeometryModeChange: (newMode: GeometryMode) => void;

  // Simple mode handlers
  updateSimpleField: (field: 'length' | 'width', val: number) => void;
  addWindow: () => void;
  removeWindow: (id: string) => void;
  updateWindow: (id: string, field: keyof Opening, val: number | string) => void;
  addDoor: () => void;
  removeDoor: (id: string) => void;
  updateDoor: (id: string, field: keyof Opening, val: number | string) => void;

  // Extended mode handlers
  addSubSection: () => void;
  removeSubSection: (id: string) => void;
  updateSubSection: (
    id: string,
    field: keyof RoomSubSection,
    val: string | number | RoomSubSection['shape'] | Opening[] | WallSection[],
  ) => void;
  updateSubSectionWindow: (
    subSectionId: string,
    windowId: string,
    field: keyof Opening,
    val: number | string,
  ) => void;
  addSubSectionWindow: (subSectionId: string) => void;
  removeSubSectionWindow: (subSectionId: string, windowId: string) => void;
  updateSubSectionDoor: (
    subSectionId: string,
    doorId: string,
    field: keyof Opening,
    val: number | string,
  ) => void;
  addSubSectionDoor: (subSectionId: string) => void;
  removeSubSectionDoor: (subSectionId: string, doorId: string) => void;

  // Advanced mode handlers
  addSegment: () => void;
  removeSegment: (id: string) => void;
  updateSegment: (id: string, field: keyof RoomSegment, val: string | number) => void;
  addObstacle: () => void;
  removeObstacle: (id: string) => void;
  updateObstacle: (id: string, field: keyof Obstacle, val: string | number) => void;
  addWallSection: () => void;
  removeWallSection: (id: string) => void;
  updateWallSection: (id: string, field: keyof WallSection, val: string | number) => void;
}
