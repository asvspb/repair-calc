import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ProjectProvider, useProjectContext } from '../../src/contexts/ProjectContext';
import { WorkTemplateProvider } from '../../src/contexts/WorkTemplateContext';
import type { RoomData, RoomSubSection } from '../../src/types';
import { createNewProject, createNewRoom } from '../../src/utils/factories';

const TEST_PROJECTS = [
  {
    ...createNewProject(),
    name: 'Test Project',
  }
];

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider initialProjects={TEST_PROJECTS}>
      <WorkTemplateProvider>
        {children}
      </WorkTemplateProvider>
    </ProjectProvider>
  );
}

describe('Extended Mode - Section Dimensions Data Integrity', () => {
  const createExtendedRoom = (): RoomData => ({
    ...createNewRoom(),
    name: 'Test Room',
    geometryMode: 'extended',
    subSections: [],
    extendedModeData: {
      subSections: []
    }
  });

  it('should preserve dimensions when adding second section', () => {
    const { result } = renderHook(() => useProjectContext(), {
      wrapper: TestWrapper,
    });

    // First add a room to the project
    const room = createExtendedRoom();
    act(() => {
      result.current.addRoom(room);
    });

    const roomId = result.current.activeProject?.rooms[0].id;
    expect(roomId).toBeDefined();
    
    // Add first section with dimensions
    const section1: RoomSubSection = {
      id: 's1',
      name: 'Section 1',
      shape: 'rectangle',
      length: 5,
      width: 4,
      windows: [],
      doors: [],
    };

    // Simulate adding section 1 via updateRoom
    act(() => {
      const currentRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
      if (currentRoom) {
        result.current.updateRoom({ ...currentRoom, subSections: [section1] });
      }
    });

    let updatedRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
    expect(updatedRoom?.subSections[0].length).toBe(5);
    expect(updatedRoom?.subSections[0].width).toBe(4);

    // Add second section
    const section2: RoomSubSection = {
      id: 's2',
      name: 'Section 2',
      shape: 'rectangle',
      length: 3,
      width: 3,
      windows: [],
      doors: [],
    };

    act(() => {
      const currentRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
      if (currentRoom) {
        result.current.updateRoom({
          ...currentRoom,
          subSections: [section1, section2]
        });
      }
    });

    updatedRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
    
    // Section 1 should preserve its dimensions
    expect(updatedRoom?.subSections[0].length).toBe(5);
    expect(updatedRoom?.subSections[0].width).toBe(4);
    
    // Section 2 should have its own dimensions
    expect(updatedRoom?.subSections[1].length).toBe(3);
    expect(updatedRoom?.subSections[1].width).toBe(3);
  });

  it('should preserve trapezoid dimensions when updating another section', () => {
    const { result } = renderHook(() => useProjectContext(), {
      wrapper: TestWrapper,
    });

    // Add room first
    const room = createExtendedRoom();
    act(() => {
      result.current.addRoom(room);
    });

    const roomId = result.current.activeProject?.rooms[0].id!;
    
    // Add two trapezoid sections
    const section1: RoomSubSection = {
      id: 's1',
      name: 'Trapezoid 1',
      shape: 'trapezoid',
      base1: 6,
      base2: 4,
      depth: 5,
      side1: 5,
      side2: 5,
      length: 0,
      width: 0,
      windows: [],
      doors: [],
    };

    const section2: RoomSubSection = {
      id: 's2',
      name: 'Trapezoid 2',
      shape: 'trapezoid',
      base1: 8,
      base2: 6,
      depth: 4,
      side1: 6,
      side2: 6,
      length: 0,
      width: 0,
      windows: [],
      doors: [],
    };

    act(() => {
      const currentRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
      if (currentRoom) {
        result.current.updateRoom({ ...currentRoom, subSections: [section1, section2] });
      }
    });

    let updatedRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
    
    // Verify initial values
    expect(updatedRoom?.subSections[0].base1).toBe(6);
    expect(updatedRoom?.subSections[0].base2).toBe(4);
    expect(updatedRoom?.subSections[0].depth).toBe(5);
    
    expect(updatedRoom?.subSections[1].base1).toBe(8);
    expect(updatedRoom?.subSections[1].base2).toBe(6);
    expect(updatedRoom?.subSections[1].depth).toBe(4);

    // Update section 1's base1
    const updatedSection1 = { ...section1, base1: 10 };
    act(() => {
      const currentRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
      if (currentRoom) {
        result.current.updateRoom({
          ...currentRoom,
          subSections: [updatedSection1, section2]
        });
      }
    });

    updatedRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
    
    // Section 1 should have new value
    expect(updatedRoom?.subSections[0].base1).toBe(10);
    
    // Section 2 should be unchanged - THIS IS THE KEY TEST
    expect(updatedRoom?.subSections[1].base1).toBe(8);
    expect(updatedRoom?.subSections[1].base2).toBe(6);
    expect(updatedRoom?.subSections[1].depth).toBe(4);
  });

  // Note: extendedModeData is only updated via RoomEditor handlers (updateSubSection etc.)
  // Direct updateRoom calls don't sync extendedModeData - this is by design
  // The important tests above verify that section data is preserved correctly

  it('should handle shape change without losing data', () => {
    const { result } = renderHook(() => useProjectContext(), {
      wrapper: TestWrapper,
    });

    // Add room first
    const room = createExtendedRoom();
    act(() => {
      result.current.addRoom(room);
    });

    const roomId = result.current.activeProject?.rooms[0].id!;
    
    // Start with rectangle
    const section: RoomSubSection = {
      id: 's1',
      name: 'Section',
      shape: 'rectangle',
      length: 5,
      width: 4,
      windows: [],
      doors: [],
    };

    act(() => {
      const currentRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
      if (currentRoom) {
        result.current.updateRoom({ ...currentRoom, subSections: [section] });
      }
    });

    let updatedRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
    expect(updatedRoom?.subSections[0].shape).toBe('rectangle');
    expect(updatedRoom?.subSections[0].length).toBe(5);

    // Change to trapezoid
    const updatedSection = {
      ...section,
      shape: 'trapezoid' as const,
      base1: 6,
      base2: 4,
      depth: 5,
      side1: 5,
      side2: 5,
    };

    act(() => {
      const currentRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
      if (currentRoom) {
        result.current.updateRoom({
          ...currentRoom,
          subSections: [updatedSection]
        });
      }
    });

    updatedRoom = result.current.activeProject?.rooms.find(r => r.id === roomId);
    
    // Shape should be updated
    expect(updatedRoom?.subSections[0].shape).toBe('trapezoid');
    
    // Trapezoid fields should be present
    expect(updatedRoom?.subSections[0].base1).toBe(6);
    expect(updatedRoom?.subSections[0].base2).toBe(4);
    expect(updatedRoom?.subSections[0].depth).toBe(5);
  });
});
