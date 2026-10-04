/**
 * Тесты ServerSyncSection (TASK-BATCH-013-split-ui): подписи кнопок,
 * disabled на время запроса, колбэки.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServerSyncSection } from '../../../src/components/projects/ServerSyncSection';

const defaultProps = {
  isSavingToServer: false,
  isLoadingFromServer: false,
  onSaveAll: vi.fn(),
  onLoadAll: vi.fn(),
};

describe('ServerSyncSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит заголовок и обе кнопки', () => {
    render(<ServerSyncSection {...defaultProps} />);

    expect(screen.getByText('Синхронизация с сервером')).toBeInTheDocument();
    expect(screen.getByText('Сохранить все')).toBeInTheDocument();
    expect(screen.getByText('Загрузить все')).toBeInTheDocument();
  });

  it('клик вызывает колбэки', () => {
    render(<ServerSyncSection {...defaultProps} />);

    fireEvent.click(screen.getByText('Сохранить все'));
    fireEvent.click(screen.getByText('Загрузить все'));

    expect(defaultProps.onSaveAll).toHaveBeenCalledTimes(1);
    expect(defaultProps.onLoadAll).toHaveBeenCalledTimes(1);
  });

  it('во время сохранения кнопка отключена и показывает «Сохранение...»', () => {
    render(<ServerSyncSection {...defaultProps} isSavingToServer />);

    const btn = screen.getByText('Сохранение...').closest('button') as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });

  it('во время загрузки кнопка отключена и показывает «Загрузка...»', () => {
    render(<ServerSyncSection {...defaultProps} isLoadingFromServer />);

    const btn = screen.getByText('Загрузка...').closest('button') as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });
});
