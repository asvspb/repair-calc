/**
 * Тесты ImportPanel (TASK-BATCH-013-split-ui): клик по кнопке открывает file input;
 * успешный файл открывает диалог с дефолтным названием; подтверждение передаёт
 * trim-нутое имя; ошибка парсинга выставляет error-статус.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportPanel } from '../../../src/components/backup/ImportPanel';

const { storageMock, countMock } = vi.hoisted(() => ({
  storageMock: {
    importFromJSON: vi.fn(),
    clearAll: vi.fn(),
  },
  countMock: vi.fn(() => 2),
}));

vi.mock('../../../src/utils/storage', () => ({
  StorageManager: storageMock,
  countImportedObjects: countMock,
}));

// FileReader заглушка: onload вызывается синхронно
class MockFileReader {
  onload: ((e: { target: { result: string } }) => void) | null = null;
  readAsText() {
    this.onload?.({ target: { result: '{"mocked":true}' } });
  }
}
vi.stubGlobal('FileReader', MockFileReader);

const setImportStatus = vi.fn();
const onOpenDialog = vi.fn();
const onConfirmImport = vi.fn();

const defaultProps = {
  setImportStatus,
  onOpenDialog,
  onConfirmImport,
};

describe('ImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит кнопку загрузки бэкапа и скрытый file input', () => {
    render(<ImportPanel {...defaultProps} />);

    expect(screen.getByTestId('restore-backup-btn')).toBeInTheDocument();
    expect(screen.getByTestId('import-file-input')).toBeInTheDocument();
  });

  it('клик по кнопке открывает диалог выбора файла', () => {
    render(<ImportPanel {...defaultProps} />);
    const input = screen.getByTestId('import-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(screen.getByTestId('restore-backup-btn'));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('валидный файл открывает диалог импорта и закрывает меню', async () => {
    storageMock.importFromJSON.mockReturnValue({
      success: true,
      data: {
        projects: [{ id: 'p1', name: 'Проект', objects: [] }],
        activeProjectId: 'p1',
      },
    });
    render(<ImportPanel {...defaultProps} />);

    const input = screen.getByTestId('import-file-input');
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Будет создан проект с', { exact: false })).toBeInTheDocument();
    });
    expect(onOpenDialog).toHaveBeenCalled();

    // Дефолтное название — «Импорт от dd.mm.yyyy»
    const nameInput = screen.getByPlaceholderText('Введите название проекта') as HTMLInputElement;
    expect(nameInput.value).toMatch(/^Импорт от \d{2}\.\d{2}\.\d{4}$/);
  });

  it('ошибка парсинга выставляет error-статус без диалога', async () => {
    storageMock.importFromJSON.mockReturnValue({ error: 'Некорректный JSON' });
    render(<ImportPanel {...defaultProps} />);

    const input = screen.getByTestId('import-file-input');
    const file = new File(['bad'], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(setImportStatus).toHaveBeenCalledWith({
        type: 'error',
        message: 'Некорректный JSON',
      });
    });
    expect(
      screen.queryByRole('heading', { name: 'Импорт данных', level: 2 }),
    ).not.toBeInTheDocument();
  });

  it('подтверждение передаёт данные и trim-нутое название', async () => {
    storageMock.importFromJSON.mockReturnValue({
      success: true,
      data: {
        projects: [{ id: 'p1', name: 'Проект', objects: [] }],
        activeProjectId: 'p1',
      },
    });
    render(<ImportPanel {...defaultProps} />);

    const input = screen.getByTestId('import-file-input');
    fireEvent.change(input, {
      target: { files: [new File(['{}'], 'b.json', { type: 'application/json' })] },
    });

    await screen.findByRole('heading', { name: 'Импорт данных', level: 2 });
    const nameInput = screen.getByPlaceholderText('Введите название проекта');
    fireEvent.change(nameInput, { target: { value: '  Мой проект  ' } });

    fireEvent.click(screen.getByText('Импортировать'));

    await waitFor(() => {
      expect(onConfirmImport).toHaveBeenCalledTimes(1);
    });
    const [dataArg, nameArg] = onConfirmImport.mock.calls[0];
    expect(nameArg).toBe('Мой проект');
    expect(dataArg.projects).toHaveLength(1);
    expect(dataArg.objectCount).toBe(2);
  });

  it('кнопка «Отмена» закрывает диалог', async () => {
    storageMock.importFromJSON.mockReturnValue({
      success: true,
      data: { projects: [], activeProjectId: '' },
    });
    render(<ImportPanel {...defaultProps} />);

    const input = screen.getByTestId('import-file-input');
    fireEvent.change(input, {
      target: { files: [new File(['{}'], 'b.json', { type: 'application/json' })] },
    });

    await screen.findByRole('heading', { name: 'Импорт данных', level: 2 });
    fireEvent.click(screen.getByText('Отмена'));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Импорт данных', level: 2 }),
      ).not.toBeInTheDocument();
    });
    expect(onConfirmImport).not.toHaveBeenCalled();
  });
});
