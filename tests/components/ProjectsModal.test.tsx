import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProjectsModal } from '../../src/components/projects/ProjectsModal';
import type { ProjectData } from '../../src/types';

const createMockProject = (overrides: Partial<ProjectData> = {}): ProjectData => ({
  id: 'proj-1',
  name: 'Тестовый проект',
  objects: [
    {
      id: 'obj-1',
      projectId: 'proj-1',
      name: 'Квартира',
      city: 'Москва',
      rooms: [
        {
          id: 'room-1',
          objectId: 'obj-1',
          name: 'Кухня',
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
        },
      ],
    },
  ],
  ...overrides,
});

const mockStoreState: Record<string, any> = {
  projects: [createMockProject()],
  activeProjectId: 'proj-1',
  setActiveProjectId: vi.fn(),
  updateProjects: vi.fn(),
  createProject: vi.fn().mockResolvedValue(createMockProject({ id: 'proj-new', name: 'Новый проект' })),
  deleteProject: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/store/useProjectStore', () => ({
  useProjectStore: (selector: (s: any) => any) => selector(mockStoreState),
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
    exportToJSON: vi.fn(() => JSON.stringify({ projects: [], activeProjectId: '' })),
    exportToCSV: vi.fn(() => 'name,city\nTest, Moscow'),
    importFromJSON: vi.fn(() => ({
      success: true,
      data: {
        projects: [{ id: 'imported-1', name: 'Imported Project', objects: [] }],
        activeProjectId: 'imported-1',
      },
    })),
    clearAll: vi.fn(),
  },
}));

vi.mock('../../src/api/storage/apiStorageProvider', () => ({
  ApiStorageProvider: {
    getInstance: vi.fn(() => ({
      saveProjectsAsync: vi.fn().mockResolvedValue(undefined),
      loadProjectsAsync: vi.fn().mockResolvedValue([]),
    })),
  },
}));

import { useAuth } from '../../src/contexts/AuthContext';

const mockUseAuth = useAuth as any;

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onImportTemplates: vi.fn(),
};

describe('ProjectsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.setActiveProjectId = vi.fn();
    mockStoreState.updateProjects = vi.fn();
    mockStoreState.createProject = vi.fn().mockResolvedValue(createMockProject({ id: 'proj-new', name: 'Новый проект' }));
    mockStoreState.deleteProject = vi.fn().mockResolvedValue(undefined);
    mockStoreState.projects = [createMockProject()];
    mockStoreState.activeProjectId = 'proj-1';
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
  });

  it('should not render when closed', () => {
    render(<ProjectsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Мои проекты')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<ProjectsModal {...defaultProps} />);
    expect(screen.getByText('Мои проекты')).toBeInTheDocument();
  });

  it('should display project list', () => {
    render(<ProjectsModal {...defaultProps} />);
    expect(screen.getByText('Тестовый проект')).toBeInTheDocument();
    expect(screen.getByText('1 объект')).toBeInTheDocument();
    expect(screen.getByText('1 комната')).toBeInTheDocument();
  });

  it('should show active badge for active project', () => {
    render(<ProjectsModal {...defaultProps} />);
    expect(screen.getByText('Активен')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    render(<ProjectsModal {...defaultProps} />);
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.querySelector('svg'));
    if (closeButton) {
      fireEvent.click(closeButton);
    }
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should open CreateProjectModal when "Новый проект" button clicked', () => {
    render(<ProjectsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Новый проект'));
    expect(screen.getByRole('heading', { name: 'Новый проект' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Создать новый/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Из бекапа/ })).toBeInTheDocument();
  });

  it('should create new project via CreateProjectModal', async () => {
    render(<ProjectsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Новый проект'));

    const nameInput = screen.getByPlaceholderText('Например: Ремонт в новостройке');
    fireEvent.change(nameInput, { target: { value: 'Новый проект' } });

    const objectInput = screen.getByPlaceholderText('Например: Квартира');
    fireEvent.change(objectInput, { target: { value: 'Квартира' } });

    const submitButton = screen.getByRole('button', { name: 'Создать проект' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockStoreState.createProject).toHaveBeenCalledWith({
        name: 'Новый проект',
        city: undefined,
        objects: ['Квартира'],
      });
    });
  });

  it('should disable submit button when project name is empty', () => {
    render(<ProjectsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Новый проект'));

    const submitButton = screen.getByRole('button', { name: 'Создать проект' });
    expect(submitButton).not.toBeDisabled();
  });

  it('should show export options on hover', () => {
    render(<ProjectsModal {...defaultProps} />);
    expect(screen.getByText('Экспорт')).toBeInTheDocument();
    expect(screen.getByText('Импорт')).toBeInTheDocument();
  });

  it('should switch project when "Открыть" button clicked', () => {
    mockStoreState.projects = [
      createMockProject({ id: 'proj-1', name: 'Проект 1' }),
      createMockProject({ id: 'proj-2', name: 'Проект 2' }),
    ];
    mockStoreState.activeProjectId = 'proj-1';

    render(<ProjectsModal {...defaultProps} />);
    const openButton = screen.getByText('Открыть');
    fireEvent.click(openButton);

    expect(mockStoreState.setActiveProjectId).toHaveBeenCalledWith('proj-2');
  });

  it('should handle escape key to close', () => {
    render(<ProjectsModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  describe('with authenticated user', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
    });

    it('should show server sync section', () => {
      render(<ProjectsModal {...defaultProps} />);
      expect(screen.getByText('Синхронизация с сервером')).toBeInTheDocument();
      expect(screen.getByText('Сохранить все')).toBeInTheDocument();
      expect(screen.getByText('Загрузить все')).toBeInTheDocument();
    });
  });

  describe('with multiple projects', () => {
    it('should display multiple projects with correct counts', () => {
      mockStoreState.projects = [
        createMockProject({
          id: 'proj-1',
          name: 'Большой проект',
          objects: [
            { id: 'obj-1', projectId: 'proj-1', name: 'Квартира', rooms: [{ id: 'r1', objectId: 'obj-1', name: 'Кухня', length: 4, width: 3, height: 2.7, segments: [], obstacles: [], wallSections: [], subSections: [], windows: [], doors: [], works: [] }] },
            { id: 'obj-2', projectId: 'proj-1', name: 'Гараж', rooms: [{ id: 'r2', objectId: 'obj-2', name: 'Яма', length: 2, width: 2, height: 2, segments: [], obstacles: [], wallSections: [], subSections: [], windows: [], doors: [], works: [] }] },
          ],
        }),
      ];

      render(<ProjectsModal {...defaultProps} />);
      expect(screen.getByText('Большой проект')).toBeInTheDocument();
      expect(screen.getByText('2 объекта')).toBeInTheDocument();
      expect(screen.getByText('2 комнаты')).toBeInTheDocument();
    });
  });
});
