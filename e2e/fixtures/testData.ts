import type { ProjectData } from '../../src/types';

export const TEST_PROJECT: ProjectData = {
  id: 'test-project-1',
  name: 'Тестовый проект',
  objects: [{
    id: 'test-obj-1',
    name: 'Квартира',
    projectId: 'test-project-1',
    rooms: [{
      id: 'test-room-1',
      name: 'Комната 1',
      length: 4, width: 3, height: 2.7,
      geometryMode: 'simple',
      windows: [], doors: [],
      segments: [], obstacles: [], wallSections: [], subSections: [],
      works: [],
    }],
  }],
};

export const TEST_PROJECT_MULTI_OBJECT: ProjectData = {
  id: 'test-project-2',
  name: 'Многообъектный проект',
  objects: [
    {
      id: 'test-obj-1',
      name: 'Квартира',
      projectId: 'test-project-2',
      rooms: [{
        id: 'test-room-1',
        name: 'Комната 1',
        length: 4, width: 3, height: 2.7,
        geometryMode: 'simple',
        windows: [], doors: [],
        segments: [], obstacles: [], wallSections: [], subSections: [],
        works: [],
      }],
    },
    {
      id: 'test-obj-2',
      name: 'Офис',
      projectId: 'test-project-2',
      rooms: [{
        id: 'test-room-2',
        name: 'Комната 2',
        length: 6, width: 4, height: 3,
        geometryMode: 'simple',
        windows: [], doors: [],
        segments: [], obstacles: [], wallSections: [], subSections: [],
        works: [],
      }],
    },
  ],
};

export const TEST_PROJECT_WITH_WORK: ProjectData = {
  id: 'test-project-3',
  name: 'Проект с работами',
  objects: [{
    id: 'test-obj-1',
    name: 'Квартира',
    projectId: 'test-project-3',
    rooms: [{
      id: 'test-room-1',
      name: 'Комната 1',
      length: 3, width: 2.5, height: 2.7,
      geometryMode: 'simple',
      windows: [], doors: [],
      segments: [], obstacles: [], wallSections: [], subSections: [],
      works: [{
        id: 'test-work-1',
        name: 'Укладка плитки',
        unit: 'м²',
        enabled: true,
        workUnitPrice: 1500,
        materialPriceType: 'total',
        materialPrice: 0,
        materials: [],
        tools: [],
        count: 0,
        calculationType: 'floorArea',
        isCustom: true,
      }],
    }],
  }],
};
