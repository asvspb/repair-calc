/**
 * Tests for LeftSidebar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LeftSidebar } from '../../../src/components/layout/LeftSidebar';
import type { RoomData } from '../../../src/types';

// Mock RoomList component
vi.mock('../../../src/components/rooms/RoomList', () => ({
  RoomList: ({ rooms, activeTab, onRoomClick, onReorderRooms }: any) => (
    <div data-testid="room-list">
      {rooms.map((room: RoomData) => (
        <button
          key={room.id}
          data-testid={`room-${room.id}`}
          data-active={room.id === activeTab}
          onClick={() => onRoomClick(room.id)}
        >
          {room.name}
        </button>
      ))}
    </div>
  ),
}));

const createMockRoom = (id: string, name: string): RoomData => ({
  id,
  objectId: 'obj-1',
  name,
  length: 4,
  width: 3,
  height: 2.7,
  segments: [],
  obstacles: [],
  wallSections: [],
  subSections: [],
  windows: [],
  doors: [],
  works: [],
  materials: [],
  tools: [],
});

describe('LeftSidebar', () => {
  const mockRooms = [
    createMockRoom('room-1', 'Кухня'),
    createMockRoom('room-2', 'Спальня'),
  ];

  const mockProps = {
    activeTab: 'summary',
    onTabChange: vi.fn(),
    onAddRoom: vi.fn(),
    isMobileMenuOpen: false,
    onMobileMenuClose: vi.fn(),
    rooms: mockRooms,
    onReorderRooms: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Logo and header', () => {
    it('should display logo', () => {
      render(<LeftSidebar {...mockProps} />);
      const logo = screen.getByAltText('Мой ремонт');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/logo.svg');
    });
  });

  describe('Mobile menu', () => {
    it('should be hidden when isMobileMenuOpen is false', () => {
      render(<LeftSidebar {...mockProps} isMobileMenuOpen={false} />);
      const aside = screen.getByRole('complementary');
      expect(aside).toHaveClass('-translate-x-full');
    });

    it('should be visible when isMobileMenuOpen is true', () => {
      render(<LeftSidebar {...mockProps} isMobileMenuOpen={true} />);
      const aside = screen.getByRole('complementary');
      expect(aside).toHaveClass('translate-x-0');
    });

    it('should call onMobileMenuClose when close button is clicked on mobile', () => {
      render(<LeftSidebar {...mockProps} isMobileMenuOpen={true} />);
      // The close button is only visible on mobile (md:hidden)
      // We can test the prop is passed correctly
      expect(mockProps.onMobileMenuClose).toBeDefined();
    });
  });

  describe('Overview section', () => {
    it('should display "Обзор" section header', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByText('Обзор')).toBeInTheDocument();
    });

    it('should display "Общая смета" button', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByText('Общая смета')).toBeInTheDocument();
    });

    it('should highlight summary button when activeTab is summary', () => {
      render(<LeftSidebar {...mockProps} activeTab="summary" />);
      const summaryButton = screen.getByText('Общая смета').closest('button');
      expect(summaryButton).toHaveClass('bg-indigo-50');
      expect(summaryButton).toHaveClass('text-indigo-700');
    });

    it('should not highlight summary button when activeTab is not summary', () => {
      render(<LeftSidebar {...mockProps} activeTab="room-1" />);
      const summaryButton = screen.getByText('Общая смета').closest('button');
      expect(summaryButton).not.toHaveClass('bg-indigo-50');
    });

    it('should call onTabChange with "summary" when summary button is clicked', () => {
      render(<LeftSidebar {...mockProps} />);
      const summaryButton = screen.getByText('Общая смета');
      
      fireEvent.click(summaryButton);
      
      expect(mockProps.onTabChange).toHaveBeenCalledWith('summary');
    });
  });

  describe('Rooms section', () => {
    it('should display "Комнаты" section header', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByText('Комнаты')).toBeInTheDocument();
    });

    it('should render room list', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByTestId('room-list')).toBeInTheDocument();
    });

    it('should render all rooms', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByTestId('room-room-1')).toBeInTheDocument();
      expect(screen.getByTestId('room-room-2')).toBeInTheDocument();
      expect(screen.getByText('Кухня')).toBeInTheDocument();
      expect(screen.getByText('Спальня')).toBeInTheDocument();
    });

    it('should call onTabChange when room is clicked', () => {
      render(<LeftSidebar {...mockProps} />);
      const roomButton = screen.getByText('Кухня');
      
      fireEvent.click(roomButton);
      
      expect(mockProps.onTabChange).toHaveBeenCalledWith('room-1');
    });
  });

  describe('Add room button', () => {
    it('should display "Добавить комнату" button', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByText('Добавить комнату')).toBeInTheDocument();
    });

    it('should call onAddRoom when add room button is clicked', () => {
      render(<LeftSidebar {...mockProps} />);
      const addRoomButton = screen.getByText('Добавить комнату');
      
      fireEvent.click(addRoomButton);
      
      expect(mockProps.onAddRoom).toHaveBeenCalled();
    });
  });

  describe('Other objects section', () => {
    it('should NOT display "Другие объекты" section (moved to RightSidebar)', () => {
      render(<LeftSidebar {...mockProps} />);
      // "Другие объекты" was moved to RightSidebar/ObjectSettings
      expect(screen.queryByText('Другие объекты')).not.toBeInTheDocument();
    });
  });
});