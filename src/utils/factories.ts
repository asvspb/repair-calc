import type { RoomData, ProjectData, Material, Tool } from '../types';

export const createNewProject = (): ProjectData => ({
  id: Math.random().toString(36).substring(2, 11),
  name: 'Новый объект',
  rooms: []
});

export const createNewRoom = (): RoomData => ({
  id: Math.random().toString(36).substring(2, 11),
  name: 'Новая комната',
  geometryMode: 'simple',
  length: 0,
  width: 0,
  height: 0,
  segments: [],
  obstacles: [],
  wallSections: [],
  subSections: [],
  windows: [],
  doors: [],
  works: [],
  simpleModeData: {
    length: 0,
    width: 0,
    windows: [],
    doors: []
  },
  extendedModeData: {
    subSections: []
  },
  advancedModeData: {
    segments: [],
    obstacles: [],
    wallSections: []
  }
});

// Создание нового материала
export const createNewMaterial = (unit: string): Material => ({
  id: Math.random().toString(36).substring(2, 11),
  name: '',
  quantity: 1,
  unit: unit,
  pricePerUnit: 0
});

// Создание нового инструмента
export const createNewTool = (): Tool => ({
  id: Math.random().toString(36).substring(2, 11),
  name: '',
  quantity: 1,
  price: 0,
  isRent: false,
  rentPeriod: 1
});