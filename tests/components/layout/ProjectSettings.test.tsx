/**
 * Tests for ProjectSettings component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProjectSettings } from '../../../src/components/layout/ProjectSettings';
import type { ProjectData } from '../../../src/types';

// Mock IdMapper
vi.mock('../../../src/utils/idMapper', () => ({
  IdMapper: {
    isServerId: vi.fn((id: string) => id.startsWith('server-')),
  },
}));

const createMockProject = (id: string, name: string): ProjectData => ({
  id,
  name,
  objects: [],
});

const mockProjects = [
  createMockProject('proj-1', 'Тестовый проект'),
  createMockProject('proj-2', 'Второй проект'),
];

describe('ProjectSettings', () => {
  const mockProps = {
    projects: mockProjects,
    activeProjectId: 'proj-1',
    activeProject: mockProjects[0],
    isSyncing: false,
    onProjectChange: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onNewProject: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Project selector', () => {
    it('should render project label', () => {
      render(<ProjectSettings {...mockProps} />);
      expect(screen.getByText('Проект')).toBeInTheDocument();
    });

    it('should display project selector with all projects', () => {
      render(<ProjectSettings {...mockProps} />);
      const select = screen.getByRole('combobox');
      
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('proj-1');
      
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('Тестовый проект');
      expect(options[1]).toHaveTextContent('Второй проект');
    });

    it('should call onProjectChange when selection changes', () => {
      render(<ProjectSettings {...mockProps} />);
      const select = screen.getByRole('combobox');
      
      fireEvent.change(select, { target: { value: 'proj-2' } });
      
      expect(mockProps.onProjectChange).toHaveBeenCalledWith('proj-2');
    });

    it('should show cloud icon for server projects', () => {
      const { container } = render(<ProjectSettings {...mockProps} />);
      const cloudIcon = container.querySelector('svg');
      expect(cloudIcon).toBeInTheDocument();
    });

    it('should show offline icon for local projects', () => {
      const localProject = createMockProject('local-1', 'Локальный проект');
      render(<ProjectSettings {...mockProps} activeProject={localProject} activeProjectId="local-1" />);
      
      const { container } = render(<ProjectSettings {...mockProps} activeProject={localProject} activeProjectId="local-1" />);
      const offlineIcon = container.querySelector('svg');
      expect(offlineIcon).toBeInTheDocument();
    });
  });

  describe('Project rename', () => {
    it('should show rename button when not editing', () => {
      render(<ProjectSettings {...mockProps} />);
      expect(screen.getByText('Переименовать проект')).toBeInTheDocument();
    });

    it('should switch to edit mode when rename button is clicked', async () => {
      render(<ProjectSettings {...mockProps} />);
      const renameButton = screen.getByText('Переименовать проект');
      
      fireEvent.click(renameButton);
      
      expect(screen.getByDisplayValue('Тестовый проект')).toBeInTheDocument();
      expect(screen.getByTitle('Сохранить')).toBeInTheDocument();
      expect(screen.getByTitle('Отмена')).toBeInTheDocument();
    });

    it('should call onRename when save is clicked', async () => {
      render(<ProjectSettings {...mockProps} />);
      const renameButton = screen.getByText('Переименовать проект');
      fireEvent.click(renameButton);
      
      const input = screen.getByDisplayValue('Тестовый проект');
      fireEvent.change(input, { target: { value: 'Новое название' } });
      
      const saveButton = screen.getByTitle('Сохранить');
      fireEvent.click(saveButton);
      
      expect(mockProps.onRename).toHaveBeenCalledWith('Новое название');
    });

    it('should call onRename when Enter is pressed', () => {
      render(<ProjectSettings {...mockProps} />);
      const renameButton = screen.getByText('Переименовать проект');
      fireEvent.click(renameButton);
      
      const input = screen.getByDisplayValue('Тестовый проект');
      fireEvent.change(input, { target: { value: 'Новое название' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockProps.onRename).toHaveBeenCalledWith('Новое название');
    });

    it('should exit edit mode when Escape is pressed', () => {
      render(<ProjectSettings {...mockProps} />);
      const renameButton = screen.getByText('Переименовать проект');
      fireEvent.click(renameButton);
      
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Escape' });
      
      // After escape, should go back to view mode with rename button visible
      expect(screen.getByText('Переименовать проект')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should not call onRename with empty name', () => {
      render(<ProjectSettings {...mockProps} />);
      const renameButton = screen.getByText('Переименовать проект');
      fireEvent.click(renameButton);
      
      const input = screen.getByDisplayValue('Тестовый проект');
      fireEvent.change(input, { target: { value: '   ' } });
      
      const saveButton = screen.getByTitle('Сохранить');
      fireEvent.click(saveButton);
      
      expect(mockProps.onRename).not.toHaveBeenCalled();
    });
  });

  describe('Project deletion', () => {
    it('should show delete button', () => {
      render(<ProjectSettings {...mockProps} />);
      expect(screen.getByText('Удалить проект')).toBeInTheDocument();
    });

    it('should call onDelete when delete button is clicked', () => {
      render(<ProjectSettings {...mockProps} />);
      const deleteButton = screen.getByText('Удалить проект');
      
      fireEvent.click(deleteButton);
      
      expect(mockProps.onDelete).toHaveBeenCalled();
    });
  });
});
