/**
 * Tests for ObjectCard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ObjectCard } from '../../src/components/objects/ObjectCard';

const mockObject = {
  id: 'obj-1',
  projectId: 'proj-1',
  name: 'Квартира',
  city: 'Москва',
  rooms: [
    { id: 'room-1', objectId: 'obj-1', name: 'Кухня', length: 4, width: 3, height: 2.7 },
    { id: 'room-2', objectId: 'obj-1', name: 'Ванная', length: 2, width: 2, height: 2.7 },
  ],
};

describe('ObjectCard', () => {
  const defaultProps = {
    object: mockObject,
    isActive: false,
    roomsCount: 2,
    onClick: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCopy: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render object card with name', () => {
    render(<ObjectCard {...defaultProps} />);
    expect(screen.getByText('Квартира')).toBeInTheDocument();
  });

  it('should show city if provided', () => {
    render(<ObjectCard {...defaultProps} />);
    expect(screen.getByText('Москва')).toBeInTheDocument();
  });

  it('should show rooms count', () => {
    render(<ObjectCard {...defaultProps} />);
    expect(screen.getByText('2 комнаты')).toBeInTheDocument();
  });

  it('should use correct pluralization for 1 room', () => {
    render(<ObjectCard {...defaultProps} roomsCount={1} />);
    expect(screen.getByText('1 комната')).toBeInTheDocument();
  });

  it('should use correct pluralization for 4 rooms', () => {
    render(<ObjectCard {...defaultProps} roomsCount={4} />);
    expect(screen.getByText('4 комнаты')).toBeInTheDocument();
  });

  it('should use correct pluralization for 5 rooms', () => {
    render(<ObjectCard {...defaultProps} roomsCount={5} />);
    expect(screen.getByText('5 комнат')).toBeInTheDocument();
  });

  it('should apply active styling when isActive is true', () => {
    render(<ObjectCard {...defaultProps} isActive={true} />);
    const card = screen.getByText('Квартира').closest('.object-card');
    expect(card).toHaveClass('border-blue-500');
    expect(card).toHaveClass('bg-blue-50');
  });

  it('should not apply active styling when isActive is false', () => {
    render(<ObjectCard {...defaultProps} isActive={false} />);
    const card = screen.getByText('Квартира').closest('.object-card');
    expect(card).not.toHaveClass('border-blue-500');
    expect(card).toHaveClass('border-gray-200');
  });

  it('should apply blue ring when isActive is true', () => {
    render(<ObjectCard {...defaultProps} isActive={true} />);
    const card = screen.getByText('Квартира').closest('.object-card');
    expect(card).toHaveClass('ring-blue-500');
  });

  it('should call onClick when card clicked', () => {
    render(<ObjectCard {...defaultProps} />);
    const card = screen.getByText('Квартира').closest('[role="button"]') || 
                 screen.getByText('Квартира').parentElement?.parentElement;
    if (card) {
      fireEvent.click(card);
    }
    expect(defaultProps.onClick).toHaveBeenCalled();
  });

  it('should call onEdit when edit button clicked', () => {
    render(<ObjectCard {...defaultProps} />);
    const editButton = screen.getByTitle('Редактировать');
    fireEvent.click(editButton);
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it('should call onCopy when copy button clicked', () => {
    render(<ObjectCard {...defaultProps} />);
    const copyButton = screen.getByTitle('Копировать');
    fireEvent.click(copyButton);
    expect(defaultProps.onCopy).toHaveBeenCalled();
  });

  it('should call onDelete when delete button clicked', () => {
    render(<ObjectCard {...defaultProps} />);
    const deleteButton = screen.getByTitle('Удалить');
    fireEvent.click(deleteButton);
    expect(defaultProps.onDelete).toHaveBeenCalled();
  });

  it('should hide city when not provided', () => {
    const objectWithoutCity = { ...mockObject, city: undefined };
    render(<ObjectCard {...defaultProps} object={objectWithoutCity} />);
    expect(screen.queryByText('Москва')).not.toBeInTheDocument();
  });
});
