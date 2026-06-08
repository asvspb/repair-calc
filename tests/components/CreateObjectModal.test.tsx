/**
 * Tests for CreateObjectModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CreateObjectModal } from '../../src/components/objects/CreateObjectModal';

// Mock store
vi.mock('../../src/store/useProjectStore', () => ({
  useProjectStore: (selector: (s: any) => any) => selector(mockStoreState),
}));

const mockStoreState: Record<string, any> = {
  createObject: vi.fn(),
  updateObject: vi.fn(),
  activeProject: {
    id: 'proj-1',
    name: 'Тестовый проект',
    objects: [],
  },
};

describe('CreateObjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.createObject = vi.fn();
    mockStoreState.updateObject = vi.fn();
  });

  it('should render modal', () => {
    render(<CreateObjectModal onClose={vi.fn()} />);
    expect(screen.getByText('Новый объект')).toBeInTheDocument();
  });

  it('should show name and city inputs', () => {
    render(<CreateObjectModal onClose={vi.fn()} />);
    expect(screen.getByText('Название объекта *')).toBeInTheDocument();
    expect(screen.getByText('Город')).toBeInTheDocument();
  });

  it('should have name input with correct placeholder', () => {
    render(<CreateObjectModal onClose={vi.fn()} />);
    const nameInput = screen.getByPlaceholderText('Например: Квартира, Дом, Офис');
    expect(nameInput).toBeInTheDocument();
  });

  it('should have city input with correct placeholder', () => {
    render(<CreateObjectModal onClose={vi.fn()} />);
    const cityInput = screen.getByPlaceholderText('Например: Москва');
    expect(cityInput).toBeInTheDocument();
  });

  it('should show error when submitting without name', () => {
    render(<CreateObjectModal onClose={vi.fn()} />);
    const submitButton = screen.getByText('Создать');
    fireEvent.click(submitButton);

    expect(screen.getByText('Введите название объекта')).toBeInTheDocument();
  });

  it('should call createObject with correct data', async () => {
    render(<CreateObjectModal onClose={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText('Например: Квартира, Дом, Офис');
    fireEvent.change(nameInput, { target: { value: 'Новая квартира' } });

    const cityInput = screen.getByPlaceholderText('Например: Москва');
    fireEvent.change(cityInput, { target: { value: 'Санкт-Петербург' } });

    const submitButton = screen.getByText('Создать');
    fireEvent.click(submitButton);

    expect(mockStoreState.createObject).toHaveBeenCalledWith({
      name: 'Новая квартира',
      city: 'Санкт-Петербург',
    });
  });

  it('should call onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<CreateObjectModal onClose={onClose} />);

    const cancelButton = screen.getByText('Отмена');
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose after successful create', async () => {
    const onClose = vi.fn();
    render(<CreateObjectModal onClose={onClose} />);

    const nameInput = screen.getByPlaceholderText('Например: Квартира, Дом, Офис');
    fireEvent.change(nameInput, { target: { value: 'Тест' } });

    const submitButton = screen.getByText('Создать');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const mockObject = {
      id: 'obj-1',
      projectId: 'proj-1',
      name: 'Существующий объект',
      city: 'Казань',
      rooms: [],
    };

    it('should show edit title when object provided', () => {
      render(<CreateObjectModal object={mockObject} onClose={vi.fn()} />);
      expect(screen.getByText('Редактировать объект')).toBeInTheDocument();
    });

    it('should populate form with object data', () => {
      render(<CreateObjectModal object={mockObject} onClose={vi.fn()} />);
      const nameInput = screen.getByDisplayValue('Существующий объект');
      expect(nameInput).toBeInTheDocument();

      const cityInput = screen.getByDisplayValue('Казань');
      expect(cityInput).toBeInTheDocument();
    });

    it('should call updateObject when editing', async () => {
      render(<CreateObjectModal object={mockObject} onClose={vi.fn()} />);

      const nameInput = screen.getByDisplayValue('Существующий объект');
      fireEvent.change(nameInput, { target: { value: 'Обновлённое название' } });

      const submitButton = screen.getByText('Сохранить');
      fireEvent.click(submitButton);

      expect(mockStoreState.updateObject).toHaveBeenCalledWith('obj-1', {
        name: 'Обновлённое название',
        city: 'Казань',
      });
    });

    it('should show save button instead of create', () => {
      render(<CreateObjectModal object={mockObject} onClose={vi.fn()} />);
      expect(screen.getByText('Сохранить')).toBeInTheDocument();
      expect(screen.queryByText('Создать')).not.toBeInTheDocument();
    });
  });

  describe('keyboard support', () => {
    it('should handle Escape key', () => {
      const onClose = vi.fn();
      render(<CreateObjectModal onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    it('should clear error when name input changes', () => {
      render(<CreateObjectModal onClose={vi.fn()} />);

      // Trigger error
      const submitButton = screen.getByText('Создать');
      fireEvent.click(submitButton);

      expect(screen.getByText('Введите название объекта')).toBeInTheDocument();

      // Clear error by typing
      const nameInput = screen.getByPlaceholderText('Например: Квартира, Дом, Офис');
      fireEvent.change(nameInput, { target: { value: 'Тест' } });

      expect(screen.queryByText('Введите название объекта')).not.toBeInTheDocument();
    });
  });
});
