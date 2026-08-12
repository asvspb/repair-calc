/**
 * Tests for CreateProjectModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CreateProjectModal } from '../../src/components/projects/CreateProjectModal';
import type { ProjectData } from '../../src/types';

// Mock StorageManager
vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
    importFromJSON: vi.fn(() => ({
      success: true,
      data: {
        projects: [
          { id: 'proj-1', name: 'Импортированный проект 1', objects: [] },
          { id: 'proj-2', name: 'Импортированный проект 2', objects: [] },
        ],
        activeProjectId: 'proj-1',
        exportedAt: '2026-04-01T10:00:00Z',
      },
    })),
  },
}));

vi.mock('../../src/utils/projectObjects', () => ({
  migrateProjectToObjects: vi.fn((p: ProjectData) => p),
}));

const mockOnClose = vi.fn();
const mockOnCreate = vi.fn();
const mockOnImport = vi.fn();

const defaultProps = {
  isOpen: true,
  onClose: mockOnClose,
  onCreate: mockOnCreate,
  onImportFromBackup: mockOnImport,
  isCreating: false,
};

describe('CreateProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    render(<CreateProjectModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Новый проект')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<CreateProjectModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: 'Новый проект' })).toBeInTheDocument();
  });

  it('should show two tabs: create new and backup', () => {
    render(<CreateProjectModal {...defaultProps} />);
    expect(screen.getByRole('tab', { name: /Создать новый/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Из бекапа/ })).toBeInTheDocument();
  });

  it('should have create tab active by default', () => {
    render(<CreateProjectModal {...defaultProps} />);
    const createTab = screen.getByRole('tab', { name: /Создать новый/ });
    const backupTab = screen.getByRole('tab', { name: /Из бекапа/ });
    expect(createTab).toHaveAttribute('aria-selected', 'true');
    expect(backupTab).toHaveAttribute('aria-selected', 'false');
  });

  it('should switch to backup tab when clicked', () => {
    render(<CreateProjectModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('tab', { name: /Из бекапа/ }));
    const backupTab = screen.getByRole('tab', { name: /Из бекапа/ });
    expect(backupTab).toHaveAttribute('aria-selected', 'true');
  });

  describe('create new project tab', () => {
    it('should show project name, objects, and city fields', () => {
      render(<CreateProjectModal {...defaultProps} />);
      expect(screen.getByLabelText('Название проекта *')).toBeInTheDocument();
      expect(screen.getByText('Объекты *')).toBeInTheDocument();
      expect(screen.getByLabelText('Город')).toBeInTheDocument();
    });

    it('should create project with name and objects on submit', async () => {
      render(<CreateProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByLabelText('Название проекта *'), {
        target: { value: 'Ремонт квартиры' },
      });
      fireEvent.change(screen.getByPlaceholderText('Например: Квартира'), {
        target: { value: 'Квартира' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Создать проект' }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          name: 'Ремонт квартиры',
          city: undefined,
          objects: ['Квартира'],
        });
      });
    });

    it('should add object field when "Добавить объект" clicked', () => {
      render(<CreateProjectModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Добавить объект'));

      const objectInputs = screen.getAllByPlaceholderText(/Название объекта|Например: Квартира/);
      expect(objectInputs).toHaveLength(2);
    });

    it('should remove object field when delete button clicked', () => {
      render(<CreateProjectModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Добавить объект'));

      const deleteButtons = screen.getAllByTitle('Удалить объект');
      fireEvent.click(deleteButtons[0]);

      const objectInputs = screen.getAllByPlaceholderText(/Название объекта|Например: Квартира/);
      expect(objectInputs).toHaveLength(1);
    });

    it('should show error when submitting without project name', () => {
      render(<CreateProjectModal {...defaultProps} />);
      // Don't fill in project name, just fill object
      fireEvent.change(screen.getByPlaceholderText('Например: Квартира'), {
        target: { value: 'Квартира' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Создать проект' }));

      expect(screen.getByText('Введите название проекта')).toBeInTheDocument();
    });

    it('should call onClose on cancel', () => {
      render(<CreateProjectModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should submit on Escape key', () => {
      render(<CreateProjectModal {...defaultProps} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('backup import tab', () => {
    it('should show file upload area on backup tab', () => {
      render(<CreateProjectModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('tab', { name: /Из бекапа/ }));
      expect(screen.getByText('Выберите файл бекапа')).toBeInTheDocument();
    });

    it('should show project list after file selection', async () => {
      render(<CreateProjectModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('tab', { name: /Из бекапа/ }));

      // Trigger file selection
      const hiddenInput = screen.getByRole('button', { name: /Выберите файл бекапа/ })
        .parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      if (hiddenInput) {
        const file = new File(['{}'], 'backup.json', { type: 'application/json' });
        fireEvent.change(hiddenInput, { target: { files: [file] } });
      }

      // FileReader.onload is async in jsdom
      await waitFor(() => {
        expect(screen.getByText('Найдено проектов: 2')).toBeInTheDocument();
      });
    });

    it('should show checkboxes with role="checkbox" for projects', async () => {
      render(<CreateProjectModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('tab', { name: /Из бекапа/ }));

      // Trigger file selection
      const hiddenInput = screen.getByRole('button', { name: /Выберите файл бекапа/ })
        .parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      if (hiddenInput) {
        const file = new File(['{}'], 'backup.json', { type: 'application/json' });
        fireEvent.change(hiddenInput, { target: { files: [file] } });
      }

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
