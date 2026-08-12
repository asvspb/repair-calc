/**
 * Tests for ObjectSettings component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ObjectSettings, OtherObjectsSection } from '../../../src/components/layout/ObjectSettings';
import type { ObjectData } from '../../../src/types';

const createMockObject = (id: string, name: string, city?: string): ObjectData => ({
  id,
  projectId: 'proj-1',
  name,
  city,
  rooms: [],
});

describe('ObjectSettings', () => {
  const mockObjects = [
    createMockObject('obj-1', 'Квартира', 'Москва'),
    createMockObject('obj-2', 'Гараж'),
  ];

  const mockProps = {
    objects: mockObjects,
    activeObjectId: 'obj-1',
    activeObject: mockObjects[0],
    onObjectChange: vi.fn(),
    onAddObject: vi.fn(),
    city: 'Москва',
    onCityChange: vi.fn(),
    hasProjects: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering conditions', () => {
    it('should show "Нет объектов" when objects list is empty', () => {
      render(<ObjectSettings {...mockProps} objects={[]} />);
      expect(screen.getByText('Объект ремонта')).toBeInTheDocument();
      expect(screen.getByText('Нет объектов')).toBeInTheDocument();
    });

    it('should render when objects exist', () => {
      render(<ObjectSettings {...mockProps} />);
      expect(screen.getByText('Объект ремонта')).toBeInTheDocument();
      expect(screen.getByText('Город')).toBeInTheDocument();
    });
  });

  describe('Object selector', () => {
    it('should display single object name when only one object exists', () => {
      const singleObject = [createMockObject('obj-1', 'Квартира')];
      render(<ObjectSettings {...mockProps} objects={singleObject} activeObject={singleObject[0]} />);
      
      expect(screen.getByText('Квартира')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should display selector when multiple objects exist', () => {
      render(<ObjectSettings {...mockProps} />);
      const select = screen.getByRole('combobox');
      
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('obj-1');
    });

    it('should show object names in selector options', () => {
      render(<ObjectSettings {...mockProps} />);
      const select = screen.getByRole('combobox');

      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('Квартира');
      expect(options[1]).toHaveTextContent('Гараж');
    });

    it('should call onObjectChange when selection changes', () => {
      render(<ObjectSettings {...mockProps} />);
      const select = screen.getByRole('combobox');
      
      fireEvent.change(select, { target: { value: 'obj-2' } });
      
      expect(mockProps.onObjectChange).toHaveBeenCalledWith('obj-2');
    });

    it('should show add object button when multiple objects exist', () => {
      render(<ObjectSettings {...mockProps} />);
      const addButton = screen.getByTitle('Добавить объект');
      expect(addButton).toBeInTheDocument();
    });

    it('should not show add object button when only one object exists', () => {
      const singleObject = [createMockObject('obj-1', 'Квартира')];
      render(<ObjectSettings {...mockProps} objects={singleObject} activeObject={singleObject[0]} />);
      
      expect(screen.queryByTitle('Добавить объект')).not.toBeInTheDocument();
    });

    it('should call onAddObject when add button is clicked', () => {
      render(<ObjectSettings {...mockProps} />);
      const addButton = screen.getByTitle('Добавить объект');
      
      fireEvent.click(addButton);
      
      expect(mockProps.onAddObject).toHaveBeenCalled();
    });
  });

  describe('City input', () => {
    it('should display city input with current value', () => {
      render(<ObjectSettings {...mockProps} />);
      const cityInput = screen.getByPlaceholderText('Для поиска цен');
      
      expect(cityInput).toBeInTheDocument();
      expect(cityInput).toHaveValue('Москва');
    });

    it('should call onCityChange when city input changes', () => {
      render(<ObjectSettings {...mockProps} />);
      const cityInput = screen.getByPlaceholderText('Для поиска цен');
      
      fireEvent.change(cityInput, { target: { value: 'Санкт-Петербург' } });
      
      expect(mockProps.onCityChange).toHaveBeenCalledWith('Санкт-Петербург');
    });

    it('should handle empty city value', () => {
      render(<ObjectSettings {...mockProps} city="" />);
      const cityInput = screen.getByPlaceholderText('Для поиска цен');
      
      expect(cityInput).toHaveValue('');
      
      fireEvent.change(cityInput, { target: { value: 'Казань' } });
      expect(mockProps.onCityChange).toHaveBeenCalledWith('Казань');
    });
  });
});

describe('OtherObjectsSection', () => {
  const mockObjects: ObjectData[] = [
    { id: 'obj-1', projectId: 'proj-1', name: 'Квартира', rooms: [{ id: 'r1', name: 'Кухня' } as any] },
    { id: 'obj-2', projectId: 'proj-1', name: 'Гараж', rooms: [{ id: 'r2', name: 'Бокс' } as any] },
    { id: 'obj-3', projectId: 'proj-1', name: 'Мастерская', rooms: [] },
  ];

  const mockProps = {
    objects: mockObjects,
    activeObjectId: 'obj-1',
    onObjectClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering conditions', () => {
    it('should not render when there are no other objects (only active)', () => {
      render(<OtherObjectsSection {...mockProps} objects={[mockObjects[0]]} />);
      expect(screen.queryByText('Другие объекты')).not.toBeInTheDocument();
    });

    it('should render when there are other objects', () => {
      render(<OtherObjectsSection {...mockProps} />);
      expect(screen.getByText('Другие объекты')).toBeInTheDocument();
    });
  });

  describe('Other objects list', () => {
    it('should display other object names (excluding active)', () => {
      render(<OtherObjectsSection {...mockProps} />);
      expect(screen.getByText('Гараж')).toBeInTheDocument();
      expect(screen.getByText('Мастерская')).toBeInTheDocument();
      expect(screen.queryByText('Квартира')).not.toBeInTheDocument(); // Active object should not be shown
    });

    it('should display room count for each object', () => {
      render(<OtherObjectsSection {...mockProps} />);
      expect(screen.getByText('1 комната')).toBeInTheDocument(); // Гараж has 1 room
    });

    it('should call onObjectClick when object is clicked', () => {
      render(<OtherObjectsSection {...mockProps} />);
      const objectButton = screen.getByText('Гараж').closest('button');
      
      fireEvent.click(objectButton!);
      
      expect(mockProps.onObjectClick).toHaveBeenCalledWith('obj-2');
    });
  });
});
