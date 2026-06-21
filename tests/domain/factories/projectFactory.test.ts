import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneProject } from '../../../src/domain/factories/projectFactory';
import type { ProjectData, ObjectData, RoomData, WorkData, Material } from '../../src/types';

describe('cloneProject', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMinimalProject = (overrides: Partial<ProjectData> = {}): ProjectData => ({
    id: 'original-proj-1',
    name: 'Test Project',
    city: 'Москва',
    objects: [],
    rooms: [],
    ...overrides,
  });

  const createRoom = (id: string, overrides: Partial<RoomData> = {}): RoomData => ({
    id,
    name: 'Test Room',
    geometryMode: 'simple',
    length: 5,
    width: 4,
    height: 3,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [{ id: 'win-1', width: 1.5, height: 1.5, comment: '' }],
    doors: [{ id: 'door-1', width: 0.9, height: 2.1, comment: '' }],
    works: [
      {
        id: 'work-1',
        name: 'Flooring',
        category: 'flooring',
        enabled: true,
        workUnitPrice: 500,
        calculationType: 'floorArea',
        unit: 'м²',
        materials: [
          { id: 'mat-1', name: 'Laminate', quantity: 10, unit: 'м²', pricePerUnit: 1500 },
        ],
        tools: [
          { id: 'tool-1', name: 'Saw', quantity: 1, price: 500, isRent: true, rentPeriod: 1 },
        ],
      },
    ],
    ...overrides,
  });

  describe('project-level cloning', () => {
    it('should generate new project id', () => {
      const project = createMinimalProject();
      const clone = cloneProject(project);
      expect(clone.id).not.toBe(project.id);
      expect(clone.id).toBeTypeOf('string');
    });

    it('should append "(копия)" to the project name', () => {
      const project = createMinimalProject({ name: 'Kitchen Reno' });
      const clone = cloneProject(project);
      expect(clone.name).toBe('Kitchen Reno (копия)');
    });

    it('should preserve original project name unchanged', () => {
      const project = createMinimalProject({ name: 'Kitchen Reno' });
      cloneProject(project);
      expect(project.name).toBe('Kitchen Reno');
    });

    it('should not share reference with original project (deep clone)', () => {
      const project = createMinimalProject({
        objects: [
          { id: 'obj-1', projectId: 'original-proj-1', name: 'Floor 1', rooms: [], sortOrder: 0 },
        ],
      });
      const clone = cloneProject(project);
      expect(clone).not.toBe(project);
      expect(clone.objects).not.toBe(project.objects);
      expect(clone.objects![0]).not.toBe(project.objects![0]);
    });

    it('should deep equal the original except for ids and name', () => {
      const project = createMinimalProject({
        city: 'СПб',
        objects: [
          { id: 'obj-1', projectId: 'original-proj-1', name: 'Floor 1', rooms: [], sortOrder: 0 },
        ],
      });
      const clone = cloneProject(project);
      expect(clone.city).toBe(project.city);
      expect(clone.objects).toHaveLength(1);
      expect(clone.objects![0].name).toBe(project.objects![0].name);
    });
  });

  describe('nested object cloning', () => {
    it('should generate new ids for objects', () => {
      const project = createMinimalProject({
        objects: [
          { id: 'obj-1', projectId: 'original-proj-1', name: 'Floor 1', rooms: [], sortOrder: 0 },
          { id: 'obj-2', projectId: 'original-proj-1', name: 'Floor 2', rooms: [], sortOrder: 1 },
        ],
      });
      const clone = cloneProject(project);
      clone.objects!.forEach((obj, i) => {
        expect(obj.id).not.toBe(project.objects![i].id);
      });
    });

    it('should update projectId in cloned objects', () => {
      const project = createMinimalProject({
        objects: [
          { id: 'obj-1', projectId: 'original-proj-1', name: 'Floor 1', rooms: [], sortOrder: 0 },
        ],
      });
      const clone = cloneProject(project);
      clone.objects!.forEach(obj => {
        expect(obj.projectId).toBe(clone.id);
        expect(obj.projectId).not.toBe(project.id);
      });
    });
  });

  describe('room cloning inside objects', () => {
    it('should generate new ids for rooms inside objects', () => {
      const project = createMinimalProject({
        objects: [
          {
            id: 'obj-1',
            projectId: 'original-proj-1',
            name: 'Floor 1',
            rooms: [createRoom('room-1'), createRoom('room-2')],
            sortOrder: 0,
          },
        ],
      });
      const clone = cloneProject(project);
      clone.objects![0].rooms.forEach((room, i) => {
        expect(room.id).not.toBe(project.objects![0].rooms[i].id);
      });
    });

    it('should update objectId in cloned rooms', () => {
      const project = createMinimalProject({
        objects: [
          {
            id: 'obj-1',
            projectId: 'original-proj-1',
            name: 'Floor 1',
            rooms: [createRoom('room-1')],
            sortOrder: 0,
          },
        ],
      });
      const clone = cloneProject(project);
      const clonedObjId = clone.objects![0].id;
      clone.objects![0].rooms.forEach(room => {
        expect(room.objectId).toBe(clonedObjId);
      });
    });

    it('should generate new ids for windows and doors in rooms', () => {
      const project = createMinimalProject({
        objects: [
          {
            id: 'obj-1',
            projectId: 'original-proj-1',
            name: 'Floor 1',
            rooms: [createRoom('room-1')],
            sortOrder: 0,
          },
        ],
      });
      const clone = cloneProject(project);
      const originalRoom = project.objects![0].rooms[0];
      const clonedRoom = clone.objects![0].rooms[0];
      expect(clonedRoom.windows[0].id).not.toBe(originalRoom.windows[0].id);
      expect(clonedRoom.doors[0].id).not.toBe(originalRoom.doors[0].id);
    });

    it('should generate new ids for works, materials and tools', () => {
      const project = createMinimalProject({
        objects: [
          {
            id: 'obj-1',
            projectId: 'original-proj-1',
            name: 'Floor 1',
            rooms: [createRoom('room-1')],
            sortOrder: 0,
          },
        ],
      });
      const clone = cloneProject(project);
      const originalRoom = project.objects![0].rooms[0];
      const clonedRoom = clone.objects![0].rooms[0];
      expect(clonedRoom.works[0].id).not.toBe(originalRoom.works[0].id);
      expect(clonedRoom.works[0].materials![0].id).not.toBe(originalRoom.works[0].materials![0].id);
      expect(clonedRoom.works[0].tools![0].id).not.toBe(originalRoom.works[0].tools![0].id);
    });

    it('should generate new ids for subSections with nested windows/doors', () => {
      const project = createMinimalProject({
        objects: [
          {
            id: 'obj-1',
            projectId: 'original-proj-1',
            name: 'Floor 1',
            rooms: [
              createRoom('room-1', {
                geometryMode: 'extended',
                subSections: [
                  {
                    id: 'ss-1',
                    name: 'Bay',
                    shape: 'rectangle',
                    length: 2,
                    width: 1.5,
                    windows: [{ id: 'sw-1', width: 1, height: 1, comment: '' }],
                    doors: [],
                  },
                ],
              }),
            ],
            sortOrder: 0,
          },
        ],
      });
      const clone = cloneProject(project);
      const originalSs = project.objects![0].rooms[0].subSections![0];
      const clonedSs = clone.objects![0].rooms[0].subSections![0];
      expect(clonedSs.id).not.toBe(originalSs.id);
      expect(clonedSs.windows![0].id).not.toBe(originalSs.windows![0].id);
    });
  });

  describe('legacy rooms (project-level)', () => {
    it('should clone rooms at project level for legacy structure', () => {
      const project = createMinimalProject({ rooms: [createRoom('legacy-room-1')] });
      const clone = cloneProject(project);
      expect(clone.rooms).toHaveLength(1);
      expect(clone.rooms![0].id).not.toBe(project.rooms![0].id);
      expect(clone.rooms![0].name).toBe(project.rooms![0].name);
    });
  });

  describe('mode-specific data cloning', () => {
    it('should clone simpleModeData with new window/door ids', () => {
      const room = createRoom('room-1', {
        simpleModeData: {
          length: 5,
          width: 4,
          windows: [{ id: 'smw-1', width: 1, height: 1, comment: '' }],
          doors: [],
        },
      });
      const project = createMinimalProject({
        objects: [
          { id: 'obj-1', projectId: 'original-proj-1', name: 'Floor', rooms: [room], sortOrder: 0 },
        ],
      });
      const clone = cloneProject(project);
      const clonedSMD = clone.objects![0].rooms[0].simpleModeData;
      expect(clonedSMD).toBeDefined();
      expect(clonedSMD!.windows[0].id).not.toBe(room.simpleModeData!.windows[0].id);
    });

    it('should clone advancedModeData with new segment/obstacle ids', () => {
      const room = createRoom('room-1', {
        geometryMode: 'advanced',
        advancedModeData: {
          segments: [{ id: 'seg-1', name: 'Alcove', length: 1.5, width: 1, operation: 'add' }],
          obstacles: [
            { id: 'obs-1', name: 'Column', area: 0.25, perimeter: 1, operation: 'subtract' },
          ],
          wallSections: [{ id: 'ws-1', name: 'High wall', length: 2, height: 4 }],
        },
      });
      const project = createMinimalProject({
        objects: [
          { id: 'obj-1', projectId: 'original-proj-1', name: 'Floor', rooms: [room], sortOrder: 0 },
        ],
      });
      const clone = cloneProject(project);
      const clonedAMD = clone.objects![0].rooms[0].advancedModeData;
      expect(clonedAMD).toBeDefined();
      expect(clonedAMD!.segments[0].id).not.toBe(room.advancedModeData!.segments[0].id);
      expect(clonedAMD!.obstacles[0].id).not.toBe(room.advancedModeData!.obstacles[0].id);
      expect(clonedAMD!.wallSections[0].id).not.toBe(room.advancedModeData!.wallSections[0].id);
    });
  });

  describe('deep equality (values preserved)', () => {
    it('should preserve numeric values in cloned rooms', () => {
      const project = createMinimalProject({
        objects: [
          {
            id: 'obj-1',
            projectId: 'original-proj-1',
            name: 'Floor',
            rooms: [createRoom('room-1')],
            sortOrder: 0,
          },
        ],
      });
      const clone = cloneProject(project);
      const originalRoom = project.objects![0].rooms[0];
      const clonedRoom = clone.objects![0].rooms[0];
      expect(clonedRoom.length).toBe(originalRoom.length);
      expect(clonedRoom.width).toBe(originalRoom.width);
      expect(clonedRoom.height).toBe(originalRoom.height);
      expect(clonedRoom.works[0].workUnitPrice).toBe(500);
    });

    it('should preserve original data unchanged after clone', () => {
      const project = createMinimalProject({
        objects: [
          {
            id: 'obj-1',
            projectId: 'original-proj-1',
            name: 'Floor',
            rooms: [createRoom('room-1')],
            sortOrder: 0,
          },
        ],
      });
      const originalId = project.id;
      const originalObjId = project.objects![0].id;
      const originalRoomId = project.objects![0].rooms[0].id;
      cloneProject(project);
      expect(project.id).toBe(originalId);
      expect(project.objects![0].id).toBe(originalObjId);
      expect(project.objects![0].rooms[0].id).toBe(originalRoomId);
    });
  });
});
