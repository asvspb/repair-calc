/**
 * Tests for ObjectSelector component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ObjectSelector } from '../../src/components/objects/ObjectSelector';

// Mock context
vi.mock('../../src/contexts/ProjectContext', () => ({
  useProjectContext: vi.fn(),
}));

import { useProjectContext } from '../../src/contexts/ProjectContext';

const mockUseProjectContext = useProjectContext as any;

const createMockObject = (id: string, name: string, city?: string) => ({
  id,
  projectId: 'proj-1',
  name,
  city,
  rooms: [],
});

const mockContextValue = {
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

describe('ObjectSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProjectContext.mockReturnValue(mockContextValue);
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

    expect(mockContextValue.setActiveObjectId).toHaveBeenCalledWith('obj-2');
  });

  it('should not render when only one object exists', () => {
    mockUseProjectContext.mockReturnValue({
      ...mockContextValue,
      activeProject: {
        ...mockContextValue.activeProject,
        objects: [createMockObject('obj-1', 'Квартира')],
      },
    });

    render(<ObjectSelector />);
    expect(screen.queryByText('Объект')).not.toBeInTheDocument();
  });

  it('should not render when no objects exist', () => {
    mockUseProjectContext.mockReturnValue({
      ...mockContextValue,
      activeProject: {
        ...mockContextValue.activeProject,
        objects: [],
      },
    });

    render(<ObjectSelector />);
    expect(screen.queryByText('Объект')).not.toBeInTheDocument();
  });

  it('should show city in option text', () => {
    mockUseProjectContext.mockReturnValue({
      ...mockContextValue,
      activeProject: {
        ...mockContextValue.activeProject,
        objects: [
          createMockObject('obj-1', 'Квартира', 'Москва'),
          createMockObject('obj-2', 'Гараж'),
        ],
      },
    });

    render(<ObjectSelector />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveDisplayValue(/Москва/);
  });

  it('should apply custom className', () => {
    render(<ObjectSelector className="custom-class" />);
    expect(screen.getByText('Объект').parentElement).toHaveClass('custom-class');
  });
});
