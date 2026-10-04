/**
 * Тесты LoadProjectDialog (TASK-BATCH-013-split-ui): пустой список, загрузка,
 * список проектов с выбором, блокировка кнопки «Открыть» без выбора.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadProjectDialog } from '../../../src/components/backup/LoadProjectDialog';

const serverProjects = [
  { id: 's1', name: 'Дача', city: 'Сочи', updated_at: '2026-03-05T12:00:00Z' },
  { id: 's2', name: 'Квартира', city: null, updated_at: '2026-04-01T08:00:00Z' },
];

const noopProps = {
  onSelect: vi.fn(),
  onClose: vi.fn(),
  onLoad: vi.fn(),
};

describe('LoadProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит заголовок', () => {
    render(
      <LoadProjectDialog
        serverProjects={[]}
        isLoadingProjects={false}
        isLoadingProject={false}
        selectedProjectId={null}
        {...noopProps}
      />,
    );

    expect(screen.getByText('Открыть проект с сервера')).toBeInTheDocument();
  });

  it('пустой список показывает сообщение', () => {
    render(
      <LoadProjectDialog
        serverProjects={[]}
        isLoadingProjects={false}
        isLoadingProject={false}
        selectedProjectId={null}
        {...noopProps}
      />,
    );

    expect(screen.getByText('На сервере нет сохранённых проектов')).toBeInTheDocument();
  });

  it('состояние загрузки показывает спиннер с текстом', () => {
    render(
      <LoadProjectDialog
        serverProjects={[]}
        isLoadingProjects
        isLoadingProject={false}
        selectedProjectId={null}
        {...noopProps}
      />,
    );

    expect(screen.getByText('Загрузка списка проектов...')).toBeInTheDocument();
  });

  it('рендерит проекты, выбор включает кнопку «Открыть»', () => {
    render(
      <LoadProjectDialog
        serverProjects={serverProjects}
        isLoadingProjects={false}
        isLoadingProject={false}
        selectedProjectId={null}
        {...noopProps}
      />,
    );

    expect(screen.getByText('Дача')).toBeInTheDocument();
    expect(screen.getByText('Сочи')).toBeInTheDocument();

    const openBtn = screen.getByText('Открыть').closest('button') as HTMLButtonElement;
    expect(openBtn).toBeDisabled();

    fireEvent.click(screen.getByText('Дача'));
    expect(noopProps.onSelect).toHaveBeenCalledWith('s1');
  });

  it('с выбранным проектом кнопка «Открыть» активна и вызывает onLoad', () => {
    render(
      <LoadProjectDialog
        serverProjects={serverProjects}
        isLoadingProjects={false}
        isLoadingProject={false}
        selectedProjectId="s1"
        {...noopProps}
      />,
    );

    const openBtn = screen.getByText('Открыть').closest('button') as HTMLButtonElement;
    expect(openBtn).toBeEnabled();

    fireEvent.click(openBtn);
    expect(noopProps.onLoad).toHaveBeenCalledTimes(1);
  });

  it('«Отмена» вызывает onClose', () => {
    render(
      <LoadProjectDialog
        serverProjects={serverProjects}
        isLoadingProjects={false}
        isLoadingProject={false}
        selectedProjectId={null}
        {...noopProps}
      />,
    );

    fireEvent.click(screen.getByText('Отмена'));
    expect(noopProps.onClose).toHaveBeenCalledTimes(1);
  });
});
