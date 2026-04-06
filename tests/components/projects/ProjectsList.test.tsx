/**
 * Tests for ProjectsList component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ProjectsList } from '../../../src/components/projects/ProjectsList';
import type { ProjectData } from '../../../src/types';

const createMockProject = (id: string, name: string, objectsCount: number = 1, roomsCount: number = 2): ProjectData => ({
  id,
  name,
  objects: Array(objectsCount).fill(null).map((_, i) => ({
    id: `obj-${i}`,
    projectId: id,
    name: `Object ${i}`,
    rooms: Array(roomsCount).fill(null).map((_, j) => ({
      id: `room-${j}`,
      name: `Room ${j}`,
      geometryMode: 'simple' as const,
      length: 10,
      width: 10,
      height: 3,
      segments: [],
      obstacles: [],
      wallSections: [],
      subSections: [],
      windows: [],
      doors: [],
      works: [],
    })),
  })),
});

describe('ProjectsList', () => {
  const mockProjects = [
    createMockProject('proj-1', 'Тестовый проект', 2, 3),
    createMockProject('proj-2', 'Второй проект', 1, 1),
  ];

  const mockProps = {
    projects: mockProjects,
    activeProjectId: 'proj-1',
    onProjectSelect: vi.fn(),
    onProjectRename: vi.fn(),
    onProjectCopy: vi.fn(),
    onProjectDelete: vi.fn(),
    onNewProject: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header', () => {
    it('should display "Проекты" header', () => {
      render(<ProjectsList {...mockProps} />);
      expect(screen.getByText('Проекты')).toBeInTheDocument();
    });
  });

  describe('Project list', () => {
    it('should display all project names', () => {
      render(<ProjectsList {...mockProps} />);
      expect(screen.getByText('Тестовый проект')).toBeInTheDocument();
      expect(screen.getByText('Второй проект')).toBeInTheDocument();
    });

    it('should show active indicator for active project', () => {
      render(<ProjectsList {...mockProps} />);
      // Active project is highlighted with indigo color, not a badge
      const projectName = screen.getByText('Тестовый проект');
      expect(projectName).toHaveClass('text-indigo-700');
    });

    it('should display project stats (objects and rooms)', () => {
      render(<ProjectsList {...mockProps} />);
      expect(screen.getByText(/2 объекта/)).toBeInTheDocument();
      expect(screen.getByText(/6 комнат/)).toBeInTheDocument();
    });

    it('should call onProjectSelect when project is clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const projectButton = screen.getByText('Второй проект').closest('button');
      
      fireEvent.click(projectButton!);

      expect(mockProps.onProjectSelect).toHaveBeenCalledWith('proj-2');
    });
  });

  describe('New project button', () => {
    it('should display "Новый проект" button', () => {
      render(<ProjectsList {...mockProps} />);
      expect(screen.getByText('Новый проект')).toBeInTheDocument();
    });

    it('should call onNewProject when clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const newProjectButton = screen.getByText('Новый проект');
      
      fireEvent.click(newProjectButton);

      expect(mockProps.onNewProject).toHaveBeenCalled();
    });
  });

  describe('Rename functionality', () => {
    it('should show edit input when rename button is clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const renameButton = screen.getAllByTitle('Переименовать')[0];
      
      fireEvent.click(renameButton);

      const input = screen.getByDisplayValue('Тестовый проект');
      expect(input).toBeInTheDocument();
    });

    it('should call onProjectRename when save is clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const renameButton = screen.getAllByTitle('Переименовать')[0];
      
      fireEvent.click(renameButton);

      const input = screen.getByDisplayValue('Тестовый проект');
      fireEvent.change(input, { target: { value: 'Новое название' } });

      const saveButton = screen.getByTitle('Сохранить');
      fireEvent.click(saveButton);

      expect(mockProps.onProjectRename).toHaveBeenCalledWith('proj-1', 'Новое название');
    });

    it('should cancel editing when cancel button is clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const renameButton = screen.getAllByTitle('Переименовать')[0];
      
      fireEvent.click(renameButton);

      const cancelButton = screen.getByTitle('Отмена');
      fireEvent.click(cancelButton);

      const input = screen.queryByDisplayValue('Тестовый проект');
      expect(input).not.toBeInTheDocument();
    });
  });

  describe('Copy functionality', () => {
    it('should show confirm dialog when copy button is clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const copyButton = screen.getAllByTitle('Копировать')[0];
      
      fireEvent.click(copyButton);

      expect(screen.getByText('Копировать проект?')).toBeInTheDocument();
    });

    it('should call onProjectCopy when confirm is clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const copyButton = screen.getAllByTitle('Копировать')[0];
      
      fireEvent.click(copyButton);

      const confirmButton = screen.getByText('Копировать');
      fireEvent.click(confirmButton);

      expect(mockProps.onProjectCopy).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('Delete functionality', () => {
    it('should show confirm dialog when delete button is clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const deleteButton = screen.getAllByTitle('Удалить')[0];
      
      fireEvent.click(deleteButton);

      expect(screen.getByText('Удалить проект?')).toBeInTheDocument();
    });

    it('should call onProjectDelete when confirm is clicked', () => {
      render(<ProjectsList {...mockProps} />);
      const deleteButton = screen.getAllByTitle('Удалить')[0];
      
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByText('Удалить');
      fireEvent.click(confirmButton);

      expect(mockProps.onProjectDelete).toHaveBeenCalledWith('proj-1');
    });
  });
});
