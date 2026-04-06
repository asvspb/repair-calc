/**
 * Tests for RightSidebar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RightSidebar } from '../../../src/components/layout/RightSidebar';
import type { ProjectData, ObjectData } from '../../../src/types';

// Mock auth context
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../../src/contexts/AuthContext';

const mockUseAuth = useAuth as any;

const createMockProject = (id: string, name: string): ProjectData => ({
  id,
  name,
  objects: [],
});

const createMockObject = (id: string, name: string): ObjectData => ({
  id,
  projectId: 'proj-1',
  name,
  rooms: [],
});

describe('RightSidebar', () => {
  const mockProjects = [
    createMockProject('proj-1', 'Тестовый проект'),
    createMockProject('proj-2', 'Второй проект'),
  ];

  const mockObjects = [
    createMockObject('obj-1', 'Квартира'),
    createMockObject('obj-2', 'Гараж'),
  ];

  const mockProps = {
    isMobileMenuOpen: false,
    onMobileMenuClose: vi.fn(),
    projects: mockProjects,
    activeProjectId: 'proj-1',
    activeProject: mockProjects[0],
    isSyncing: false,
    onProjectChange: vi.fn(),
    onRenameProject: vi.fn(),
    onDeleteProject: vi.fn(),
    onNewProject: vi.fn(),
    onOpenProjects: vi.fn(),
    activeTab: 'summary',
    onTabChange: vi.fn(),
    objects: mockObjects,
    activeObjectId: 'obj-1',
    activeObject: mockObjects[0],
    onObjectChange: vi.fn(),
    showDeleteConfirm: false,
    onDeleteConfirm: vi.fn(),
    onDeleteCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: 'Тестовый пользователь', email: 'test@example.com' },
      logout: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });
  });

  describe('Mobile menu', () => {
    it('should be hidden when isMobileMenuOpen is false', () => {
      render(<RightSidebar {...mockProps} isMobileMenuOpen={false} />);
      const aside = screen.getByRole('complementary');
      expect(aside).toHaveClass('translate-x-full');
    });

    it('should be visible when isMobileMenuOpen is true', () => {
      render(<RightSidebar {...mockProps} isMobileMenuOpen={true} />);
      const aside = screen.getByRole('complementary');
      expect(aside).toHaveClass('translate-x-0');
    });

    it('should call onMobileMenuClose when close button is clicked', () => {
      render(<RightSidebar {...mockProps} isMobileMenuOpen={true} />);
      // Close button is the X button in the header
      const closeButton = screen.getByRole('button', { name: '' });

      fireEvent.click(closeButton);

      expect(mockProps.onMobileMenuClose).toHaveBeenCalled();
    });
  });

  describe('Projects header', () => {
    it('should display "Мои проекты" button', () => {
      render(<RightSidebar {...mockProps} />);
      expect(screen.getByText('Мои проекты')).toBeInTheDocument();
    });

    it('should call onOpenProjects when "Мои проекты" button is clicked', () => {
      render(<RightSidebar {...mockProps} />);
      const myProjectsButton = screen.getByText('Мои проекты');

      fireEvent.click(myProjectsButton);

      expect(mockProps.onOpenProjects).toHaveBeenCalled();
    });
  });

  describe('Overview section', () => {
    it('should display "Обзор" section header', () => {
      render(<RightSidebar {...mockProps} />);
      expect(screen.getByText('Обзор')).toBeInTheDocument();
    });

    it('should display "Общая смета" button', () => {
      render(<RightSidebar {...mockProps} />);
      expect(screen.getByText('Общая смета')).toBeInTheDocument();
    });

    it('should highlight summary button when activeTab is summary', () => {
      render(<RightSidebar {...mockProps} activeTab="summary" />);
      const summaryButton = screen.getByText('Общая смета').closest('button');
      expect(summaryButton).toHaveClass('bg-indigo-50');
      expect(summaryButton).toHaveClass('text-indigo-700');
    });

    it('should not highlight summary button when activeTab is not summary', () => {
      render(<RightSidebar {...mockProps} activeTab="room-1" />);
      const summaryButton = screen.getByText('Общая смета').closest('button');
      expect(summaryButton).not.toHaveClass('bg-indigo-50');
    });

    it('should call onTabChange with "summary" when summary button is clicked', () => {
      render(<RightSidebar {...mockProps} />);
      const summaryButton = screen.getByText('Общая смета');

      fireEvent.click(summaryButton);

      expect(mockProps.onTabChange).toHaveBeenCalledWith('summary');
    });
  });

  describe('Project settings section', () => {
    it('should render project label', () => {
      render(<RightSidebar {...mockProps} />);
      expect(screen.getByText('Проект')).toBeInTheDocument();
    });

    it('should render project selector', () => {
      render(<RightSidebar {...mockProps} />);
      const selects = screen.getAllByRole('combobox');
      // There should be at least one select (project selector)
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  describe('Other objects section', () => {
    it('should display "Другие объекты" section when there are multiple objects', () => {
      render(<RightSidebar {...mockProps} />);
      expect(screen.getByText('Другие объекты')).toBeInTheDocument();
    });
  });

  describe('Action buttons', () => {
    it('should display "Новый проект" button', () => {
      render(<RightSidebar {...mockProps} />);
      expect(screen.getByText('Новый проект')).toBeInTheDocument();
    });

    it('should call onNewProject when new project button is clicked', () => {
      render(<RightSidebar {...mockProps} />);
      const newProjectButton = screen.getByText('Новый проект');

      fireEvent.click(newProjectButton);

      expect(mockProps.onNewProject).toHaveBeenCalled();
    });
  });

  describe('Delete confirmation modal', () => {
    it('should not show modal when showDeleteConfirm is false', () => {
      render(<RightSidebar {...mockProps} showDeleteConfirm={false} />);
      expect(screen.queryByText('Удалить проект?')).not.toBeInTheDocument();
    });

    it('should show modal when showDeleteConfirm is true', () => {
      render(<RightSidebar {...mockProps} showDeleteConfirm={true} />);
      expect(screen.getByText('Удалить проект?')).toBeInTheDocument();
      expect(screen.getByText(/будет удалён безвозвратно/)).toBeInTheDocument();
    });

    it('should call onDeleteCancel when cancel button is clicked', () => {
      render(<RightSidebar {...mockProps} showDeleteConfirm={true} />);
      const cancelButton = screen.getByText('Отмена');

      fireEvent.click(cancelButton);

      expect(mockProps.onDeleteCancel).toHaveBeenCalled();
    });

    it('should call onDeleteConfirm when delete button is clicked', () => {
      render(<RightSidebar {...mockProps} showDeleteConfirm={true} />);
      const deleteButton = screen.getByText('Удалить');

      fireEvent.click(deleteButton);

      expect(mockProps.onDeleteConfirm).toHaveBeenCalled();
    });

    it('should disable buttons when isSyncing is true', () => {
      render(
        <RightSidebar
          {...mockProps}
          showDeleteConfirm={true}
          isSyncing={true}
        />
      );
      const cancelButton = screen.getByRole('button', { name: 'Отмена' });
      const deleteButton = screen.getByRole('button', { name: /Удаление/ });

      expect(cancelButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('User section', () => {
    it('should display user information', () => {
      render(<RightSidebar {...mockProps} />);
      expect(screen.getByText('Тестовый пользователь')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should show logout menu when user button is clicked', () => {
      render(<RightSidebar {...mockProps} />);
      const userButton = screen.getByText('Тестовый пользователь').closest('button');

      fireEvent.click(userButton!);

      expect(screen.getByText('Выйти')).toBeInTheDocument();
    });
  });
});
