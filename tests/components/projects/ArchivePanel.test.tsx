/**
 * Tests for ArchivePanel component (TASK-BATCH-002-archive-t4).
 * Покрывают: гостевой режим, загрузку/ошибку/пустое состояние, строку списка
 * (имя/дата/счётчики), восстановление, ConfirmDialog с вводом имени
 * (trim + учёт регистра), блокировку кнопок во время запроса, unmount-безопасность.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { ArchivePanel } from '../../../src/components/projects/ArchivePanel';
import type { ProjectData } from '../../../src/types';

type ArchivedItem = ProjectData & { objectsCount: number; roomsCount: number; archivedAt?: string };

const { storeMock, authState } = vi.hoisted(() => ({
  storeMock: {
    fetchArchivedProjects: vi.fn<() => Promise<unknown>>(),
    restoreProject: vi.fn<() => Promise<unknown>>(),
    permanentDeleteProject: vi.fn<() => Promise<unknown>>(),
    deletingIds: [] as string[],
  },
  authState: { value: true },
}));

vi.mock('../../../src/store/useProjectStore', () => ({
  useProjectStore: (selector: (s: typeof storeMock) => unknown) => selector(storeMock),
}));

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: authState.value }),
}));

vi.mock('../../../src/utils/logger', () => ({
  logUserAction: vi.fn(),
  logWarning: vi.fn(),
}));

const makeItem = (overrides: Partial<ArchivedItem> = {}): ArchivedItem => ({
  id: 'arch-1',
  name: 'Дача',
  objects: [],
  objectsCount: 2,
  roomsCount: 3,
  ...overrides,
});

describe('ArchivePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.value = true;
    storeMock.deletingIds = [];
    storeMock.fetchArchivedProjects.mockResolvedValue([]);
    storeMock.restoreProject.mockResolvedValue(undefined);
    storeMock.permanentDeleteProject.mockResolvedValue({ objects: 1, rooms: 2 });
  });

  describe('Гостевой режим', () => {
    it('секция скрыта и список не запрашивается', () => {
      authState.value = false;
      const { container } = render(<ArchivePanel />);

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByTestId('archive-panel')).not.toBeInTheDocument();
      expect(storeMock.fetchArchivedProjects).not.toHaveBeenCalled();
    });
  });

  describe('Загрузка списка', () => {
    it('запрашивает список при маунте и рендерит строки', async () => {
      storeMock.fetchArchivedProjects.mockResolvedValue([
        makeItem({ id: 'a1', name: 'Дача' }),
        makeItem({ id: 'a2', name: 'Квартира', objectsCount: 1, roomsCount: 4 }),
      ]);
      render(<ArchivePanel />);

      expect(await screen.findByText('Дача')).toBeInTheDocument();
      expect(screen.getByText('Квартира')).toBeInTheDocument();
      expect(storeMock.fetchArchivedProjects).toHaveBeenCalledTimes(1);
    });

    it('показывает пустое состояние, когда архив пуст', async () => {
      render(<ArchivePanel />);

      expect(await screen.findByTestId('archive-empty')).toBeInTheDocument();
      expect(screen.getByText('Архивных проектов нет')).toBeInTheDocument();
    });

    it('при ошибке загрузки показывает inline-ошибку с кнопкой «Повторить»', async () => {
      storeMock.fetchArchivedProjects.mockRejectedValue(new Error('network'));
      render(<ArchivePanel />);

      expect(await screen.findByTestId('archive-load-error')).toBeInTheDocument();
      expect(screen.queryByTestId('archive-empty')).not.toBeInTheDocument();

      storeMock.fetchArchivedProjects.mockResolvedValue([makeItem()]);
      fireEvent.click(screen.getByText('Повторить'));

      await waitFor(() => {
        expect(screen.getByText('Дача')).toBeInTheDocument();
      });
      expect(storeMock.fetchArchivedProjects).toHaveBeenCalledTimes(2);
    });

    it('показывает индикатор загрузки до ответа', () => {
      storeMock.fetchArchivedProjects.mockReturnValue(new Promise(() => {}));
      render(<ArchivePanel />);

      expect(screen.getByTestId('archive-loading')).toBeInTheDocument();
    });
  });

  describe('Строка архива', () => {
    it('показывает имя, счётчики и дату архивации в формате dd.MM.yyyy', async () => {
      storeMock.fetchArchivedProjects.mockResolvedValue([
        makeItem({ archivedAt: '2026-03-05T12:00:00' }),
      ]);
      render(<ArchivePanel />);

      expect(await screen.findByText('Дача')).toBeInTheDocument();
      expect(screen.getByText(/2 объекта/)).toBeInTheDocument();
      expect(screen.getByText(/3 комнаты/)).toBeInTheDocument();
      expect(screen.getByTestId('archive-date-arch-1')).toHaveTextContent('05.03.2026');
    });

    it('показывает прочерк вместо даты, если дата архивации не пришла', async () => {
      storeMock.fetchArchivedProjects.mockResolvedValue([makeItem({ archivedAt: undefined })]);
      render(<ArchivePanel />);

      expect(await screen.findByText('Дача')).toBeInTheDocument();
      expect(screen.getByTestId('archive-date-arch-1')).toHaveTextContent('—');
    });
  });

  describe('Восстановление', () => {
    it('вызывает restoreProject и убирает проект из списка архива', async () => {
      storeMock.fetchArchivedProjects.mockResolvedValue([makeItem()]);
      render(<ArchivePanel />);
      await screen.findByText('Дача');

      fireEvent.click(screen.getByText('Восстановить'));

      await waitFor(() => {
        expect(storeMock.restoreProject).toHaveBeenCalledWith('arch-1');
      });
      await waitFor(() => {
        expect(screen.queryByText('Дача')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('archive-notice')).toHaveTextContent('Проект «Дача» восстановлен');
    });

    it('при ошибке восстановления проект остаётся в списке и показывается inline-ошибка', async () => {
      storeMock.fetchArchivedProjects.mockResolvedValue([makeItem()]);
      storeMock.restoreProject.mockRejectedValue(new Error('400 Project is not archived'));
      render(<ArchivePanel />);
      await screen.findByText('Дача');

      fireEvent.click(screen.getByText('Восстановить'));

      await waitFor(() => {
        expect(screen.getByTestId('archive-notice')).toHaveTextContent(
          'Не удалось восстановить проект',
        );
      });
      expect(screen.getByText('Дача')).toBeInTheDocument();
    });

    it('блокирует кнопки действий на время запроса (pending)', async () => {
      storeMock.fetchArchivedProjects.mockResolvedValue([makeItem()]);
      let resolveRestore!: () => void;
      storeMock.restoreProject.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveRestore = resolve;
          }),
      );
      render(<ArchivePanel />);
      await screen.findByText('Дача');

      fireEvent.click(screen.getByText('Восстановить'));

      await waitFor(() => {
        expect(screen.getByText('Восстановление...')).toBeInTheDocument();
      });
      // Все кнопки действий строки отключены, пока запрос в полёте
      expect(screen.getByText('Восстановление...')).toBeDisabled();
      expect(screen.getByText('Удалить навсегда')).toBeDisabled();

      act(() => {
        resolveRestore();
      });
      await waitFor(() => {
        expect(screen.getByTestId('archive-notice')).toHaveTextContent('восстановлен');
      });
    });
  });

  describe('Удаление навсегда (ConfirmDialog с вводом имени)', () => {
    const openDialog = async () => {
      storeMock.fetchArchivedProjects.mockResolvedValue([makeItem({ name: 'Дача' })]);
      render(<ArchivePanel />);
      await screen.findByText('Дача');
      fireEvent.click(screen.getByText('Удалить навсегда'));
      await screen.findByTestId('archive-delete-dialog');
    };

    it('открывает диалог с полем ввода имени', async () => {
      await openDialog();

      expect(screen.getByTestId('archive-delete-dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('Имя проекта для подтверждения')).toBeInTheDocument();
    });

    it('кнопка подтверждения неактивна при несовпадении имени', async () => {
      await openDialog();
      const input = screen.getByLabelText('Имя проекта для подтверждения');

      fireEvent.change(input, { target: { value: 'Квартира' } });
      expect(screen.getByTestId('archive-delete-confirm')).toBeDisabled();

      // Регистрозависимо: 'дача' ≠ 'Дача' (сравнение НЕ приводится к нижнему регистру)
      fireEvent.change(input, { target: { value: 'дача' } });
      expect(screen.getByTestId('archive-delete-confirm')).toBeDisabled();
    });

    it('пробелы обрезаются перед сравнением (trim)', async () => {
      await openDialog();
      const input = screen.getByLabelText('Имя проекта для подтверждения');

      fireEvent.change(input, { target: { value: '  Дача  ' } });
      expect(screen.getByTestId('archive-delete-confirm')).toBeEnabled();

      fireEvent.click(screen.getByTestId('archive-delete-confirm'));

      await waitFor(() => {
        expect(storeMock.permanentDeleteProject).toHaveBeenCalledWith('arch-1');
      });
      await waitFor(() => {
        expect(screen.queryByText('Дача')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('archive-notice')).toHaveTextContent(
        'Проект «Дача» удалён навсегда',
      );
    });

    it('точное имя активирует подтверждение и удаляет проект', async () => {
      await openDialog();
      const input = screen.getByLabelText('Имя проекта для подтверждения');

      fireEvent.change(input, { target: { value: 'Дача' } });
      const confirm = screen.getByTestId('archive-delete-confirm');
      expect(confirm).toBeEnabled();

      fireEvent.click(confirm);

      await waitFor(() => {
        expect(storeMock.permanentDeleteProject).toHaveBeenCalledWith('arch-1');
      });
      await waitFor(() => {
        expect(screen.queryByTestId('archive-delete-dialog')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Дача')).not.toBeInTheDocument();
    });

    it('при ошибке удаления показывает inline-сообщение в панели', async () => {
      storeMock.permanentDeleteProject.mockRejectedValue(new Error('409'));
      await openDialog();
      fireEvent.change(screen.getByLabelText('Имя проекта для подтверждения'), {
        target: { value: 'Дача' },
      });
      fireEvent.click(screen.getByTestId('archive-delete-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('archive-notice')).toHaveTextContent('Не удалось удалить проект');
      });
      expect(screen.getByText('Дача')).toBeInTheDocument();
    });
  });

  describe('Unmount во время запроса', () => {
    it('не рендерит по resolution на размонтированном компоненте и не падает', () => {
      let resolveFetch!: () => void;
      storeMock.fetchArchivedProjects.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveFetch = resolve;
          }),
      );
      const { unmount } = render(<ArchivePanel />);
      unmount();

      expect(() =>
        act(() => {
          resolveFetch();
        }),
      ).not.toThrow();
    });
  });
});
