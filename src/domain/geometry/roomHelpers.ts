/**
 * Helper functions for room data updates — фасад.
 * Reduces duplication in RoomEditor by providing generic update functions
 * that handle both main fields and mode-specific data synchronization.
 * Реализация распилена на модули ./roomHelpers/ (волна B1, batch 037).
 */

export {
  updateRoomField,
  updateSimpleField,
  updateArrayItem,
  addArrayItem,
  removeArrayItem,
} from './roomHelpers/arrayUtils';
export {
  addWindow,
  removeWindow,
  updateWindow,
  addDoor,
  removeDoor,
  updateDoor,
} from './roomHelpers/windowsDoors';
export {
  createSubSection,
  addSubSection,
  removeSubSection,
  updateSubSection,
  addSubSectionWindow,
  removeSubSectionWindow,
  updateSubSectionWindow,
  addSubSectionDoor,
  removeSubSectionDoor,
  updateSubSectionDoor,
} from './roomHelpers/subSections';
export { createSegment, addSegment, removeSegment, updateSegment } from './roomHelpers/segments';
export {
  createObstacle,
  addObstacle,
  removeObstacle,
  updateObstacle,
} from './roomHelpers/obstacles';
export {
  createWallSection,
  addWallSection,
  removeWallSection,
  updateWallSection,
} from './roomHelpers/wallSections';
export { switchGeometryMode } from './roomHelpers/switchMode';
