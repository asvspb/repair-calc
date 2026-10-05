/**
 * Тесты ImportStatusBanner (TASK-BATCH-013-split-ui): три варианта цвета,
 * кнопки подтверждения/отмены только в confirm-режиме, колбэки.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportStatusBanner } from '../../../src/features/projects/ui/ImportStatusBanner';

const base = {
  onConfirm: vi.fn(),
  onDismiss: vi.fn(),
};

describe('ImportStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('success: зелёный стиль, без кнопок действий', () => {
    const { container } = render(
      <ImportStatusBanner importStatus={{ type: 'success', message: 'Ок' }} {...base} />,
    );

    expect(container.firstChild).toHaveClass('bg-green-50');
    expect(screen.getByText('Ок')).toBeInTheDocument();
    expect(screen.queryByText('Импортировать')).not.toBeInTheDocument();
  });

  it('error: красный стиль', () => {
    const { container } = render(
      <ImportStatusBanner importStatus={{ type: 'error', message: 'Ошибка' }} {...base} />,
    );

    expect(container.firstChild).toHaveClass('bg-red-50');
  });

  it('confirm: жёлтый стиль с кнопками «Импортировать»/«Отмена»', () => {
    const { container } = render(
      <ImportStatusBanner
        importStatus={{
          type: 'confirm',
          message: 'Найдено 2 проектов. Заменить текущие данные?',
        }}
        {...base}
      />,
    );

    expect(container.firstChild).toHaveClass('bg-yellow-50');
    expect(screen.getByText('Импортировать')).toBeInTheDocument();
    expect(screen.getByText('Отмена')).toBeInTheDocument();
  });

  it('кнопки confirm вызывают onConfirm/onDismiss', () => {
    render(
      <ImportStatusBanner importStatus={{ type: 'confirm', message: 'Заменить?' }} {...base} />,
    );

    fireEvent.click(screen.getByText('Импортировать'));
    fireEvent.click(screen.getByText('Отмена'));

    expect(base.onConfirm).toHaveBeenCalledTimes(1);
    expect(base.onDismiss).toHaveBeenCalledTimes(1);
  });
});
