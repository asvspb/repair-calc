/**
 * Тесты ProjectListItem (TASK-BATCH-013-split-ui): имя, счётчики с плюрализацией,
 * бейдж активного проекта, кнопка «Открыть» у неактивного, колбэки действий,
 * режим редактирования имени (Enter/Escape/blur, trim).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectListItem } from '../../../src/components/projects/ProjectListItem';
import type { ProjectData } from '../../../src/types';

const createProject = (overrides: Partial<ProjectData> = {}): ProjectData =>
  ({
    id: 'p1',
    name: 'Тестовый проект',
    city: 'Москва',
    objects: [
      {
        id: 'obj-1',
        projectId: 'p1',
        name: 'Квартира',
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
  }) as unknown as ProjectData;

const noopProps = {
  onEditingNameChange: vi.fn(),
  onStartEditing: vi.fn(),
  onRename: vi.fn(),
  onCancelEditing: vi.fn(),
  onActivate: vi.fn(),
  onCopy: vi.fn(),
  onDelete: vi.fn(),
};

describe('ProjectListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит имя, город и счётчики', () => {
    render(
      <ProjectListItem
        project={createProject()}
        isActive
        isEditing={false}
        editingName=""
        {...noopProps}
      />,
    );

    expect(screen.getByText('Тестовый проект')).toBeInTheDocument();
    expect(screen.getByText('Москва')).toBeInTheDocument();
    expect(screen.getByText(/1 объект/)).toBeInTheDocument();
    expect(screen.getByText(/1 комната/)).toBeInTheDocument();
  });

  it('показывает бейдж «Активен» у активного проекта и не показывает «Открыть»', () => {
    render(
      <ProjectListItem
        project={createProject()}
        isActive
        isEditing={false}
        editingName=""
        {...noopProps}
      />,
    );

    expect(screen.getByText('Активен')).toBeInTheDocument();
    expect(screen.queryByText('Открыть')).not.toBeInTheDocument();
  });

  it('у неактивного проекта есть кнопка «Открыть» с колбэком', () => {
    render(
      <ProjectListItem
        project={createProject()}
        isActive={false}
        isEditing={false}
        editingName=""
        {...noopProps}
      />,
    );

    fireEvent.click(screen.getByText('Открыть'));
    expect(noopProps.onActivate).toHaveBeenCalledWith('p1');
  });

  it('кнопки копирования и удаления вызывают колбэки с id', () => {
    render(
      <ProjectListItem
        project={createProject()}
        isActive
        isEditing={false}
        editingName=""
        {...noopProps}
      />,
    );

    fireEvent.click(screen.getByTitle('Копировать'));
    fireEvent.click(screen.getByTitle('Удалить'));

    expect(noopProps.onCopy).toHaveBeenCalledWith('p1');
    expect(noopProps.onDelete).toHaveBeenCalledWith('p1');
  });

  describe('Редактирование имени', () => {
    it('Enter вызывает onRename, Escape — onCancelEditing, blur — onRename', () => {
      render(
        <ProjectListItem
          project={createProject()}
          isActive
          isEditing
          editingName="Новое имя"
          {...noopProps}
        />,
      );
      const input = screen.getByDisplayValue('Новое имя');

      fireEvent.keyDown(input, { key: 'Enter' });
      expect(noopProps.onRename).toHaveBeenCalledWith('p1');

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(noopProps.onCancelEditing).toHaveBeenCalled();

      fireEvent.blur(input);
      expect(noopProps.onRename).toHaveBeenCalledTimes(2);
    });

    it('изменение текста передаётся через onEditingNameChange', () => {
      render(
        <ProjectListItem
          project={createProject()}
          isActive
          isEditing
          editingName="Старое"
          {...noopProps}
        />,
      );
      const input = screen.getByDisplayValue('Старое');

      fireEvent.change(input, { target: { value: 'Новое' } });
      expect(noopProps.onEditingNameChange).toHaveBeenCalledWith('Новое');
    });

    it('скрывает кнопку переименования в режиме редактирования', () => {
      render(
        <ProjectListItem
          project={createProject()}
          isActive
          isEditing
          editingName="x"
          {...noopProps}
        />,
      );

      expect(screen.queryByTitle('Переименовать')).not.toBeInTheDocument();
      // Кнопки копирования/удаления остаются (как и в исходном компоненте)
      expect(screen.getByTitle('Копировать')).toBeInTheDocument();
      expect(screen.getByTitle('Удалить')).toBeInTheDocument();
    });
  });
});
