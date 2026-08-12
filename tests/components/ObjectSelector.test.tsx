import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ObjectSelector } from '../../src/components/objects/ObjectSelector';

const createMockObject = (id: string, name: string, city?: string) => ({
  id,
  projectId: 'proj-1',
  name,
  city,
  rooms: [],
});

const mockStoreState: Record<string, any> = {
  activeProject: {
    id: 'proj-1',
    name: 'Тестовый проект',
    objects: [
      createMockObject('obj-1', 'Квартира'),
      createMockObject('obj-2', 'Гараж'),
    ],
  },
  activeObjectId: 'obj-1',
  setActiveObjectId: vi.fn(),
};

vi.mock('../../src/store/useProjectStore', () => ({
  useProjectStore: (selector: (s: any) => any) => selector(mockStoreState),
}));

describe('ObjectSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.setActiveObjectId = vi.fn();
    mockStoreState.activeProject = {
      id: 'proj-1',
      name: 'Тестовый проект',
      objects: [
        createMockObject('obj-1', 'Квартира'),
        createMockObject('obj-2', 'Гараж'),
      ],
    };
    mockStoreState.activeObjectId = 'obj-1';
  });

  it('should render when multiple objects exist', () => {
    render(<ObjectSelector />);
    expect(screen.getByText('Объект')).toBeInTheDocument();
  });

  it('should display object options in select', () => {
    render(<ObjectSelector />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    expect(select).toHaveValue('obj-1');
    expect(select).toHaveDisplayValue(/Квартира/);
  });

  it('should call setActiveObjectId when selection changes', () => {
    render(<ObjectSelector />);
    const select = screen.getByRole('combobox');

    fireEvent.change(select, { target: { value: 'obj-2' } });

    expect(mockStoreState.setActiveObjectId).toHaveBeenCalledWith('obj-2');
  });

  it('should not render when only one object exists', () => {
    mockStoreState.activeProject = {
      ...mockStoreState.activeProject,
      objects: [createMockObject('obj-1', 'Квартира')],
    };

    render(<ObjectSelector />);
    expect(screen.queryByText('Объект')).not.toBeInTheDocument();
  });

  it('should not render when no objects exist', () => {
    mockStoreState.activeProject = {
      ...mockStoreState.activeProject,
      objects: [],
    };

    render(<ObjectSelector />);
    expect(screen.queryByText('Объект')).not.toBeInTheDocument();
  });

  it('should show city in option text', () => {
    mockStoreState.activeProject = {
      ...mockStoreState.activeProject,
      objects: [
        createMockObject('obj-1', 'Квартира', 'Москва'),
        createMockObject('obj-2', 'Гараж'),
      ],
    };

    render(<ObjectSelector />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveDisplayValue(/Москва/);
  });

  it('should apply custom className', () => {
    render(<ObjectSelector className="custom-class" />);
    expect(screen.getByText('Объект').parentElement).toHaveClass('custom-class');
  });
});
