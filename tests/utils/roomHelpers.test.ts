import { describe, it, expect } from 'vitest'
import {
  updateArrayItem,
  addArrayItem,
  removeArrayItem,
  addWindow,
  removeWindow,
  updateWindow,
  addDoor,
  removeDoor,
  updateDoor,
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
  createSegment,
  addSegment,
  removeSegment,
  updateSegment,
  createObstacle,
  addObstacle,
  removeObstacle,
  updateObstacle,
  createWallSection,
  addWallSection,
  removeWallSection,
  updateWallSection,
  switchGeometryMode,
} from '../../src/utils/roomHelpers'
import type { RoomData } from '../../src/types'

// Create a minimal test room
const createTestRoom = (overrides: Partial<RoomData> = {}): RoomData => ({
  id: 'test-room',
  name: 'Test Room',
  geometryMode: 'simple',
  length: 5,
  width: 4,
  height: 3,
  segments: [],
  obstacles: [],
  wallSections: [],
  subSections: [],
  windows: [],
  doors: [],
  works: [],
  ...overrides,
})

describe('roomHelpers - generic array operations', () => {
  const testArray = [
    { id: '1', name: 'First' },
    { id: '2', name: 'Second' },
  ]

  describe('updateArrayItem', () => {
    it('should update item by id', () => {
      const result = updateArrayItem(testArray, '1', 'name', 'Updated')
      expect(result[0].name).toBe('Updated')
      expect(result[1].name).toBe('Second')
    })

    it('should not modify other items', () => {
      const result = updateArrayItem(testArray, '2', 'name', 'Changed')
      expect(result[0].name).toBe('First')
      expect(result[1].name).toBe('Changed')
    })

    it('should return same array if id not found', () => {
      const result = updateArrayItem(testArray, 'nonexistent', 'name', 'New')
      expect(result).toEqual(testArray)
    })
  })

  describe('addArrayItem', () => {
    it('should add item to array', () => {
      const newItem = { id: '3', name: 'Third' }
      const result = addArrayItem(testArray, newItem)
      expect(result).toHaveLength(3)
      expect(result[2]).toEqual(newItem)
    })

    it('should not mutate original array', () => {
      const newItem = { id: '3', name: 'Third' }
      addArrayItem(testArray, newItem)
      expect(testArray).toHaveLength(2)
    })
  })

  describe('removeArrayItem', () => {
    it('should remove item by id', () => {
      const result = removeArrayItem(testArray, '1')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('should return same array if id not found', () => {
      const result = removeArrayItem(testArray, 'nonexistent')
      expect(result).toEqual(testArray)
    })
  })
})

describe('roomHelpers - window operations', () => {
  it('addWindow should add a window with correct defaults', () => {
    const room = createTestRoom()
    const result = addWindow(room)
    expect(result.windows).toHaveLength(1)
    expect(result.windows[0].width).toBe(1.5)
    expect(result.windows[0].height).toBe(1.5)
  })

  it('removeWindow should remove window by id', () => {
    const room = createTestRoom({
      windows: [{ id: 'w1', width: 1, height: 1, comment: '' }],
    })
    const result = removeWindow(room, 'w1')
    expect(result.windows).toHaveLength(0)
  })

  it('updateWindow should update window field', () => {
    const room = createTestRoom({
      windows: [{ id: 'w1', width: 1, height: 1, comment: '' }],
    })
    const result = updateWindow(room, 'w1', 'width', 2)
    expect(result.windows[0].width).toBe(2)
  })
})

describe('roomHelpers - door operations', () => {
  it('addDoor should add a door with correct defaults', () => {
    const room = createTestRoom()
    const result = addDoor(room)
    expect(result.doors).toHaveLength(1)
    expect(result.doors[0].width).toBe(0.9)
    expect(result.doors[0].height).toBe(2.0)
  })

  it('removeDoor should remove door by id', () => {
    const room = createTestRoom({
      doors: [{ id: 'd1', width: 1, height: 2, comment: '' }],
    })
    const result = removeDoor(room, 'd1')
    expect(result.doors).toHaveLength(0)
  })

  it('updateDoor should update door field', () => {
    const room = createTestRoom({
      doors: [{ id: 'd1', width: 0.9, height: 2, comment: '' }],
    })
    const result = updateDoor(room, 'd1', 'height', 2.2)
    expect(result.doors[0].height).toBe(2.2)
  })
})

describe('roomHelpers - subSection operations', () => {
  describe('createSubSection', () => {
    it('should create subsection with defaults', () => {
      const sub = createSubSection()
      expect(sub.shape).toBe('rectangle')
      expect(sub.length).toBe(0)
      expect(sub.width).toBe(0)
      expect(sub.windows).toEqual([])
      expect(sub.doors).toEqual([])
    })
  })

  it('addSubSection should add subsection to room', () => {
    const room = createTestRoom()
    const result = addSubSection(room)
    expect(result.subSections).toHaveLength(1)
  })

  it('removeSubSection should remove subsection by id', () => {
    const room = createTestRoom({
      subSections: [createSubSection()],
    })
    const subId = room.subSections[0].id
    const result = removeSubSection(room, subId)
    expect(result.subSections).toHaveLength(0)
  })

  it('updateSubSection should update subsection field', () => {
    const sub = createSubSection()
    const room = createTestRoom({ subSections: [sub] })
    const result = updateSubSection(room, sub.id, 'name', 'Living Room')
    expect(result.subSections[0].name).toBe('Living Room')
  })
})

describe('roomHelpers - subSection window/door operations', () => {
  it('addSubSectionWindow should add window to subsection', () => {
    const sub = createSubSection()
    const room = createTestRoom({ subSections: [sub] })
    const result = addSubSectionWindow(room, sub.id)
    expect(result.subSections[0].windows).toHaveLength(1)
  })

  it('removeSubSectionWindow should remove window from subsection', () => {
    const sub = { ...createSubSection(), windows: [{ id: 'sw1', width: 1, height: 1, comment: '' }] }
    const room = createTestRoom({ subSections: [sub] })
    const result = removeSubSectionWindow(room, sub.id, 'sw1')
    expect(result.subSections[0].windows).toHaveLength(0)
  })

  it('updateSubSectionWindow should update window in subsection', () => {
    const sub = { ...createSubSection(), windows: [{ id: 'sw1', width: 1, height: 1, comment: '' }] }
    const room = createTestRoom({ subSections: [sub] })
    const result = updateSubSectionWindow(room, sub.id, 'sw1', 'width', 1.5)
    expect(result.subSections[0].windows[0].width).toBe(1.5)
  })

  it('addSubSectionDoor should add door to subsection', () => {
    const sub = createSubSection()
    const room = createTestRoom({ subSections: [sub] })
    const result = addSubSectionDoor(room, sub.id)
    expect(result.subSections[0].doors).toHaveLength(1)
  })
})

describe('roomHelpers - segment operations', () => {
  describe('createSegment', () => {
    it('should create segment with defaults', () => {
      const seg = createSegment()
      expect(seg.name).toBe('Ниша')
      expect(seg.operation).toBe('subtract')
    })
  })

  it('addSegment should add segment to room', () => {
    const room = createTestRoom({ geometryMode: 'advanced' })
    const result = addSegment(room)
    expect(result.segments).toHaveLength(1)
    expect(result.advancedModeData?.segments).toHaveLength(1)
  })

  it('removeSegment should remove segment', () => {
    const room = createTestRoom({
      geometryMode: 'advanced',
      segments: [createSegment()],
    })
    const segId = room.segments[0].id
    const result = removeSegment(room, segId)
    expect(result.segments).toHaveLength(0)
  })

  it('updateSegment should update segment field', () => {
    const seg = createSegment()
    const room = createTestRoom({ geometryMode: 'advanced', segments: [seg] })
    const result = updateSegment(room, seg.id, 'name', 'Bay Window')
    expect(result.segments[0].name).toBe('Bay Window')
  })
})

describe('roomHelpers - obstacle operations', () => {
  describe('createObstacle', () => {
    it('should create obstacle with defaults', () => {
      const obs = createObstacle()
      expect(obs.type).toBe('column')
      expect(obs.operation).toBe('subtract')
    })
  })

  it('addObstacle should add obstacle to room', () => {
    const room = createTestRoom({ geometryMode: 'advanced' })
    const result = addObstacle(room)
    expect(result.obstacles).toHaveLength(1)
  })

  it('removeObstacle should remove obstacle', () => {
    const room = createTestRoom({
      geometryMode: 'advanced',
      obstacles: [createObstacle()],
    })
    const obsId = room.obstacles[0].id
    const result = removeObstacle(room, obsId)
    expect(result.obstacles).toHaveLength(0)
  })

  it('updateObstacle should update obstacle field', () => {
    const obs = createObstacle()
    const room = createTestRoom({ geometryMode: 'advanced', obstacles: [obs] })
    const result = updateObstacle(room, obs.id, 'area', 0.5)
    expect(result.obstacles[0].area).toBe(0.5)
  })
})

describe('roomHelpers - wallSection operations', () => {
  describe('createWallSection', () => {
    it('should create wallSection with defaults', () => {
      const ws = createWallSection()
      expect(ws.name).toBe('Участок с перепадом')
      expect(ws.length).toBe(1)
      expect(ws.height).toBe(3)
    })
  })

  it('addWallSection should add wallSection to room', () => {
    const room = createTestRoom({ geometryMode: 'advanced' })
    const result = addWallSection(room)
    expect(result.wallSections).toHaveLength(1)
  })

  it('removeWallSection should remove wallSection', () => {
    const room = createTestRoom({
      geometryMode: 'advanced',
      wallSections: [createWallSection()],
    })
    const wsId = room.wallSections[0].id
    const result = removeWallSection(room, wsId)
    expect(result.wallSections).toHaveLength(0)
  })

  it('updateWallSection should update wallSection field', () => {
    const ws = createWallSection()
    const room = createTestRoom({ geometryMode: 'advanced', wallSections: [ws] })
    const result = updateWallSection(room, ws.id, 'height', 3.5)
    expect(result.wallSections[0].height).toBe(3.5)
  })
})

describe('roomHelpers - switchGeometryMode', () => {
  it('should return same room if mode unchanged', () => {
    const room = createTestRoom()
    const result = switchGeometryMode(room, 'simple')
    expect(result).toBe(room)
  })

  it('should switch from simple to extended', () => {
    const room = createTestRoom({
      length: 5,
      width: 4,
      windows: [{ id: 'w1', width: 1, height: 1, comment: '' }],
    })
    const result = switchGeometryMode(room, 'extended')
    expect(result.geometryMode).toBe('extended')
    expect(result.simpleModeData?.length).toBe(5)
    expect(result.simpleModeData?.windows).toHaveLength(1)
  })

  it('should switch from simple to advanced', () => {
    const room = createTestRoom({
      length: 5,
      width: 4,
    })
    const result = switchGeometryMode(room, 'advanced')
    expect(result.geometryMode).toBe('advanced')
    expect(result.simpleModeData?.length).toBe(5)
  })

  it('should restore data when switching back to simple', () => {
    // First create a room in simple mode with data
    const room = createTestRoom({
      length: 10,
      width: 8,
      windows: [{ id: 'w1', width: 1, height: 1, comment: '' }],
    })
    // Switch to extended mode (saves simple data)
    const extendedRoom = switchGeometryMode(room, 'extended')
    expect(extendedRoom.geometryMode).toBe('extended')
    expect(extendedRoom.simpleModeData?.length).toBe(10)
    
    // Now switch back to simple mode (restores simple data)
    const result = switchGeometryMode(extendedRoom, 'simple')
    expect(result.geometryMode).toBe('simple')
    expect(result.length).toBe(10)
    expect(result.width).toBe(8)
    expect(result.windows).toHaveLength(1)
  })

  it('should initialize empty arrays when no mode data exists', () => {
    const room = createTestRoom({ geometryMode: 'extended' })
    const result = switchGeometryMode(room, 'simple')
    expect(result.geometryMode).toBe('simple')
    expect(result.length).toBe(0)
    expect(result.width).toBe(0)
    expect(result.windows).toEqual([])
  })
})