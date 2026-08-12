/**
 * Tests for DataManagementModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DataManagementModal } from '../../../src/components/projects/DataManagementModal';
import type { WorkTemplate } from '../../../src/types/workTemplate';

// Mock contexts
vi.mock('../../../src/contexts/ProjectContext', () => ({
  useProjectContext: () => ({
    projects: [
      {
        id: 'proj-1',
        name: 'Тестовый проект',
        objects: [],
      },
    ],
    activeProjectId: 'proj-1',
    updateProjects: vi.fn(),
    isSyncing: false,
  }),
}));

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Тест', email: 'test@example.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../../src/utils/storage', () => ({
  StorageManager: {
    exportToJSON: vi.fn(() => JSON.stringify({ projects: [], activeProjectId: 'proj-1' })),
    exportToCSV: vi.fn(() => 'csv,data'),
    importFromJSON: vi.fn(() => ({
      success: true,
      data: {
        projects: [{ id: 'proj-1', name: 'Imported', objects: [] }],
        activeProjectId: 'proj-1',
        workTemplates: [],
      },
    })),
  },
}));

vi.mock('../../../src/api/storage/apiStorageProvider', () => ({
  ApiStorageProvider: {
    getInstance: vi.fn(() => ({
      saveProjectsAsync: vi.fn(),
      loadProjectsAsync: vi.fn(),
    })),
  },
}));

describe('DataManagementModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onImportTemplates: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('Управление данными')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(<DataManagementModal {...mockProps} isOpen={false} />);
      expect(screen.queryByText('Управление данными')).not.toBeInTheDocument();
    });

    it('should display export section', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('Экспорт')).toBeInTheDocument();
    });

    it('should display import section', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('Импорт')).toBeInTheDocument();
    });

    it('should display server sync section when authenticated', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('Синхронизация с сервером')).toBeInTheDocument();
    });
  });

  describe('Export buttons', () => {
    it('should display JSON export button', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('JSON (бэкап)')).toBeInTheDocument();
    });

    it('should display CSV export button', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('CSV (Excel)')).toBeInTheDocument();
    });
  });

  describe('Import', () => {
    it('should display file select button', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('Выбрать JSON файл')).toBeInTheDocument();
    });
  });

  describe('Server sync buttons', () => {
    it('should display save to server button', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('Сохранить все на сервер')).toBeInTheDocument();
    });

    it('should display load from server button', () => {
      render(<DataManagementModal {...mockProps} />);
      expect(screen.getByText('Загрузить все с сервера')).toBeInTheDocument();
    });
  });

  describe('Close button', () => {
    it('should call onClose when close button is clicked', () => {
      render(<DataManagementModal {...mockProps} />);
      const closeButton = screen.getByRole('button', { name: '' });
      
      fireEvent.click(closeButton);

      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });
});
