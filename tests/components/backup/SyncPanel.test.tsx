/**
 * Тесты SyncPanel (TASK-BATCH-013-split-ui): гостю ничего не рендерится;
 * авторизованному — 4 действия; «Сохранить все» кладёт проекты через
 * ApiStorageProvider и выставляет success-статус; «Сохранить как» без имени —
 * error-статус; загрузка пустого сервера — error-статус.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncPanel } from '../../../src/features/backup/ui/SyncPanel';
import type { ProjectData } from '../../../src/types';

const { providerMock, authState } = vi.hoisted(() => ({
  providerMock: {
    saveProjectsAsync: vi.fn(),
    loadProjectsAsync: vi.fn(),
    createProjectAsync: vi.fn(),
  },
  authState: { value: true },
}));

vi.mock('../../../src/features/auth/model/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: authState.value }),
}));

vi.mock('../../../src/api/storage/apiStorageProvider', () => ({
  ApiStorageProvider: {
    getInstance: () => providerMock,
  },
}));

const createProject = (id: string, name: string): ProjectData =>
  ({ id, name, objects: [] }) as unknown as ProjectData;

const setImportStatus = vi.fn();
const onImport = vi.fn();
const onOpenDialog = vi.fn();

const defaultProps = {
  projects: [createProject('p1', 'Проект')],
  activeProjectId: 'p1',
  onImport,
  setImportStatus,
  onOpenDialog,
};

describe('SyncPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.value = true;
    providerMock.saveProjectsAsync.mockResolvedValue(undefined);
    providerMock.loadProjectsAsync.mockResolvedValue([]);
    providerMock.createProjectAsync.mockResolvedValue({ id: 'srv-1', name: 'x' });
  });

  it('гостю ничего не рендерится', () => {
    authState.value = false;
    const { container } = render(<SyncPanel {...defaultProps} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('авторизованному рендерит 4 действия', () => {
    render(<SyncPanel {...defaultProps} />);

    expect(screen.getByText('Сохранить как...')).toBeInTheDocument();
    expect(screen.getByText('Открыть проект...')).toBeInTheDocument();
    expect(screen.getByText('Сохранить все')).toBeInTheDocument();
    expect(screen.getByText('Загрузить все')).toBeInTheDocument();
  });

  it('«Сохранить все» сохраняет проекты и выставляет success-статус', async () => {
    render(<SyncPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Сохранить все'));

    await waitFor(() => {
      expect(providerMock.saveProjectsAsync).toHaveBeenCalledWith(defaultProps.projects);
    });
    await waitFor(() => {
      expect(setImportStatus).toHaveBeenCalledWith({
        type: 'success',
        message: '1 проектов(а) успешно сохранены в базу данных',
      });
    });
  });

  it('«Загрузить все» с пустым сервером выставляет error-статус', async () => {
    render(<SyncPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Загрузить все'));

    await waitFor(() => {
      expect(providerMock.loadProjectsAsync).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(setImportStatus).toHaveBeenCalledWith({
        type: 'error',
        message: 'На сервере нет сохранённых проектов',
      });
    });
    expect(onImport).not.toHaveBeenCalled();
  });

  it('«Загрузить все» с проектами вызывает onImport и success-статус', async () => {
    providerMock.loadProjectsAsync.mockResolvedValue([createProject('srv-1', 'Серверный')]);
    render(<SyncPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Загрузить все'));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ id: 'srv-1' })], 'srv-1');
    });
  });

  describe('Сохранить как', () => {
    const openDialog = async () => {
      render(<SyncPanel {...defaultProps} />);
      fireEvent.click(screen.getByText('Сохранить как...'));
      await screen.findByText('Сохранить проект как');
    };

    it('открывает диалог с именем активного проекта', async () => {
      await openDialog();

      const input = screen.getByPlaceholderText('Введите название проекта') as HTMLInputElement;
      expect(input.value).toBe('Проект');
      expect(onOpenDialog).toHaveBeenCalled();
    });

    it('пустое имя блокирует кнопку сохранения', async () => {
      await openDialog();
      const input = screen.getByPlaceholderText('Введите название проекта');
      fireEvent.change(input, { target: { value: '   ' } });

      const saveBtn = screen.getByText('Сохранить').closest('button') as HTMLButtonElement;
      expect(saveBtn).toBeDisabled();
      expect(providerMock.createProjectAsync).not.toHaveBeenCalled();
    });

    it('валидное имя создаёт проект на сервере и уведомляет onImport', async () => {
      await openDialog();
      const input = screen.getByPlaceholderText('Введите название проекта');
      fireEvent.change(input, { target: { value: 'Новая дача' } });
      fireEvent.click(screen.getByText('Сохранить'));

      await waitFor(() => {
        expect(providerMock.createProjectAsync).toHaveBeenCalledWith({
          name: 'Новая дача',
          city: undefined,
        });
      });
      await waitFor(() => {
        expect(onImport).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(setImportStatus).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
      });
    });

    it('Escape закрывает диалог', async () => {
      await openDialog();
      const input = screen.getByPlaceholderText('Введите название проекта');
      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Сохранить проект как')).not.toBeInTheDocument();
      });
    });
  });
});
