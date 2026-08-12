import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LeftSidebar } from '../../../src/components/layout/LeftSidebar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../src/utils/logger', () => ({
  logUserAction: vi.fn(),
}));

describe('LeftSidebar NavLink', () => {
  const mockProps = {
    activeTab: 'summary',
    onTabChange: vi.fn(),
    onAddRoom: vi.fn(),
    isMobileMenuOpen: false,
    onMobileMenuClose: vi.fn(),
    rooms: [],
    onReorderRooms: vi.fn(),
    objects: [],
    activeObjectId: 'obj-1',
    activeObject: null,
    onObjectChange: vi.fn(),
    onAddObject: vi.fn(),
    city: '',
    onCityChange: vi.fn(),
    hasProjects: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nav-object-estimate', () => {
    render(<LeftSidebar {...mockProps} />);
    expect(screen.getByTestId('nav-object-estimate')).toBeInTheDocument();
  });

  it('calls onTabChange with object-estimate when clicked', () => {
    render(<LeftSidebar {...mockProps} />);
    fireEvent.click(screen.getByTestId('nav-object-estimate'));
    expect(mockProps.onTabChange).toHaveBeenCalledWith('object-estimate');
  });

  it('is disabled when !activeObjectId', () => {
    render(<LeftSidebar {...mockProps} activeObjectId={null} />);
    const btn = screen.getByTestId('nav-object-estimate');
    expect(btn).toBeDisabled();
  });

  it('has active style when activeTab is object-estimate', () => {
    render(<LeftSidebar {...mockProps} activeTab="object-estimate" />);
    const btn = screen.getByTestId('nav-object-estimate');
    expect(btn).toHaveClass('bg-indigo-50');
  });
});
