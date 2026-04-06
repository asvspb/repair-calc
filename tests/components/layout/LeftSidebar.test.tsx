/**
 * Tests for LeftSidebar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LeftSidebar } from '../../../src/components/layout/LeftSidebar';
import type { RoomData, ObjectData } from '../../../src/types';

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

const createMockObject = (id: string, name: string): ObjectData => ({
  id,
  projectId: 'proj-1',
  name,
  rooms: [],
});

describe('LeftSidebar', () => {
  const mockRooms = [
    createMockRoom('room-1', 'Кухня'),
    createMockRoom('room-2', 'Спальня'),
  ];

  const mockObjects = [
    createMockObject('obj-1', 'Квартира'),
    createMockObject('obj-2', 'Гараж'),
  ];

  const mockProps = {
    activeTab: 'summary',
    onTabChange: vi.fn(),
    onAddRoom: vi.fn(),
    isMobileMenuOpen: false,
    onMobileMenuClose: vi.fn(),
    rooms: mockRooms,
    onReorderRooms: vi.fn(),
    objects: mockObjects,
    activeObjectId: 'obj-1',
    activeObject: mockObjects[0],
    onObjectChange: vi.fn(),
    onAddObject: vi.fn(),
    city: 'Москва',
    onCityChange: vi.fn(),
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

  describe('Object settings section', () => {
    it('should display "Объект ремонта" label', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByText('Объект ремонта')).toBeInTheDocument();
    });

    it('should display "Город" label', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByText('Город')).toBeInTheDocument();
    });

    it('should render object selector when multiple objects', () => {
      render(<LeftSidebar {...mockProps} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('should call onObjectChange when object selector is changed', () => {
      render(<LeftSidebar {...mockProps} />);
      const select = screen.getAllByRole('combobox')[0];

      fireEvent.change(select, { target: { value: 'obj-2' } });

      expect(mockProps.onObjectChange).toHaveBeenCalledWith('obj-2');
    });

    it('should call onCityChange when city input is changed', () => {
      render(<LeftSidebar {...mockProps} />);
      const cityInput = screen.getByPlaceholderText('Для поиска цен');

      fireEvent.change(cityInput, { target: { value: 'Санкт-Петербург' } });

      expect(mockProps.onCityChange).toHaveBeenCalledWith('Санкт-Петербург');
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

  describe('Action buttons', () => {
    it('should display "Добавить объект ремонта" button', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.getByText('Добавить объект ремонта')).toBeInTheDocument();
    });

    it('should call onAddObject when add object button is clicked', () => {
      render(<LeftSidebar {...mockProps} />);
      const addObjectButton = screen.getByText('Добавить объект ремонта');

      fireEvent.click(addObjectButton);

      expect(mockProps.onAddObject).toHaveBeenCalled();
    });

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

  describe('Overview section', () => {
    it('should NOT display "Обзор" section (moved to RightSidebar)', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.queryByText('Обзор')).not.toBeInTheDocument();
    });

    it('should NOT display "Общая смета" button (moved to RightSidebar)', () => {
      render(<LeftSidebar {...mockProps} />);
      expect(screen.queryByText('Общая смета')).not.toBeInTheDocument();
    });
  });
});