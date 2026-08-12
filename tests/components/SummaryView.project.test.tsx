import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SummaryView } from '../../src/components/SummaryView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/domain/pricing/costs', () => ({
  calculateRoomCosts: () => ({
    totalWork: 100,
    totalMaterial: 50,
    totalTools: 0,
    total: 150,
  }),
}));

describe('SummaryView project scope', () => {
  const mockProject: any = {
    id: 'p1',
    name: 'Project 1',
    objects: [
      {
        id: 'o1',
        name: 'Object 1',
        rooms: [{ id: 'r1', name: 'Room 1', works: [], materials: [], tools: [] }],
      },
    ],
  };

  it('renders project estimate by default', () => {
    render(<SummaryView project={mockProject} onRoomClick={vi.fn()} />);
    expect(screen.getByText(/sidebar.projectEstimate/)).toBeInTheDocument();
  });
});
