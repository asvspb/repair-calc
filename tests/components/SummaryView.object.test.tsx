import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SummaryView } from '../../src/components/SummaryView';
import type { ProjectData } from '@shared/types';
import { calculateRoomCosts } from '../../src/domain/pricing/costs';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/domain/pricing/costs', () => ({
  calculateRoomCosts: vi.fn(() => ({
    totalWork: 100,
    totalMaterial: 50,
    totalTools: 0,
    total: 150,
  })),
}));

describe('SummaryView object scope', () => {
  const mockProject = {
    id: 'p1',
    name: 'Project 1',
    clientName: '',
    createdAt: 0,
    updatedAt: 0,
    rooms: [],
    objects: [
      { id: 'o1', name: 'Object 1', rooms: [{ id: 'r1', name: 'Room 1', length: 0, width: 0, height: 0, works: [], materials: [] }] },
      { id: 'o2', name: 'Object 2', rooms: [{ id: 'r2', name: 'Room 2', length: 0, width: 0, height: 0, works: [], materials: [] }] },
    ],
  } as unknown as ProjectData;

  it('renders object rooms only', () => {
    render(
      <SummaryView
        project={mockProject}
        onRoomClick={vi.fn()}
        scope="object"
        activeObjectId="o1"
      />
    );
    expect(screen.getByText('sidebar.objectEstimate Object 1')).toBeInTheDocument();
    expect(screen.getByText('Room 1')).toBeInTheDocument();
    expect(screen.queryByText('Room 2')).not.toBeInTheDocument();
  });

  it('handles empty object gracefully', () => {
    render(
      <SummaryView
        project={mockProject}
        onRoomClick={vi.fn()}
        scope="object"
        activeObjectId="missing"
      />
    );
    expect(screen.getByText('Нет добавленных комнат')).toBeInTheDocument();
  });

  it('changes totals when activeObjectId changes', () => {
    const { rerender } = render(
      <SummaryView
        project={mockProject}
        onRoomClick={vi.fn()}
        scope="object"
        activeObjectId="o1"
      />
    );
    expect(screen.getByText('Room 1')).toBeInTheDocument();
    rerender(
      <SummaryView
        project={mockProject}
        onRoomClick={vi.fn()}
        scope="object"
        activeObjectId="o2"
      />
    );
    expect(screen.getByText('Room 2')).toBeInTheDocument();
    expect(screen.queryByText('Room 1')).not.toBeInTheDocument();
  });

  it('consistency test (filtering): SummaryWorks shows works ONLY for the active object', () => {
    const projectWithWorks = {
      id: 'p2',
      name: 'Project 2',
      clientName: '',
      createdAt: 0,
      updatedAt: 0,
      rooms: [],
      objects: [
        {
          id: 'o1',
          name: 'Object 1',
          rooms: [
            {
              id: 'r1',
              name: 'Room 1',
              length: 0, width: 0, height: 0,
              works: [
                {
                  id: 'w1',
                  name: 'Покраска A',
                  unit: 'm2',
                  calculationType: 'customCount',
                  count: 5,
                  workUnitPrice: 100,
                  enabled: true,
                },
              ],
              materials: [],
            },
          ],
        },
        {
          id: 'o2',
          name: 'Object 2',
          rooms: [
            {
              id: 'r2',
              name: 'Room 2',
              length: 0, width: 0, height: 0,
              works: [
                {
                  id: 'w2',
                  name: 'Покраска B',
                  unit: 'm2',
                  calculationType: 'customCount',
                  count: 3,
                  workUnitPrice: 200,
                  enabled: true,
                },
              ],
              materials: [],
            },
          ],
        },
      ],
    } as unknown as ProjectData;

    render(
      <SummaryView
        project={projectWithWorks}
        onRoomClick={vi.fn()}
        scope="object"
        activeObjectId="o1"
      />
    );

    expect(screen.getByText(/Покраска A/)).toBeInTheDocument();
    expect(screen.queryByText(/Покраска B/)).not.toBeInTheDocument();
  });

  it('consistency test (filtering): SummaryMaterials shows materials ONLY for the active object', () => {
    const projectWithMaterials = {
      id: 'p3',
      name: 'Project 3',
      clientName: '',
      createdAt: 0,
      updatedAt: 0,
      rooms: [],
      objects: [
        {
          id: 'o1',
          name: 'Object 1',
          rooms: [
            {
              id: 'r1',
              name: 'Room 1',
              length: 0, width: 0, height: 0,
              works: [
                {
                  id: 'w1', name: 'Work 1', unit: 'm2', calculationType: 'customCount', count: 1, workUnitPrice: 100, enabled: true,
                  materials: [{ id: 'm1', name: 'Краска A', unit: 'л', quantity: 5, pricePerUnit: 100 }]
                },
              ],
              materials: [],
            },
          ],
        },
        {
          id: 'o2',
          name: 'Object 2',
          rooms: [
            {
              id: 'r2',
              name: 'Room 2',
              length: 0, width: 0, height: 0,
              works: [
                {
                  id: 'w2', name: 'Work 2', unit: 'm2', calculationType: 'customCount', count: 1, workUnitPrice: 100, enabled: true,
                  materials: [{ id: 'm2', name: 'Краска B', unit: 'л', quantity: 5, pricePerUnit: 100 }]
                },
              ],
              materials: [],
            },
          ],
        },
      ],
    } as unknown as ProjectData;

    render(
      <SummaryView
        project={projectWithMaterials}
        onRoomClick={vi.fn()}
        scope="object"
        activeObjectId="o1"
      />
    );

    expect(screen.getByText(/Краска A/)).toBeInTheDocument();
    expect(screen.queryByText(/Краска B/)).not.toBeInTheDocument();
  });

  it('consistency test (filtering): SummaryTools shows tools ONLY for the active object', () => {
    const projectWithTools = {
      id: 'p4',
      name: 'Project 4',
      clientName: '',
      createdAt: 0,
      updatedAt: 0,
      rooms: [],
      objects: [
        {
          id: 'o1',
          name: 'Object 1',
          rooms: [
            {
              id: 'r1',
              name: 'Room 1',
              length: 0, width: 0, height: 0,
              works: [
                {
                  id: 'w1', name: 'Work 1', unit: 'm2', calculationType: 'customCount', count: 1, workUnitPrice: 100, enabled: true,
                  tools: [{ id: 't1', name: 'Кисть A', price: 100, quantity: 1, isRent: false }]
                },
              ],
              materials: [],
            },
          ],
        },
        {
          id: 'o2',
          name: 'Object 2',
          rooms: [
            {
              id: 'r2',
              name: 'Room 2',
              length: 0, width: 0, height: 0,
              works: [
                {
                  id: 'w2', name: 'Work 2', unit: 'm2', calculationType: 'customCount', count: 1, workUnitPrice: 100, enabled: true,
                  tools: [{ id: 't2', name: 'Кисть B', price: 100, quantity: 1, isRent: false }]
                },
              ],
              materials: [],
            },
          ],
        },
      ],
    } as unknown as ProjectData;

    render(
      <SummaryView
        project={projectWithTools}
        onRoomClick={vi.fn()}
        scope="object"
        activeObjectId="o1"
      />
    );

    expect(screen.getByText(/Кисть A/)).toBeInTheDocument();
    expect(screen.queryByText(/Кисть B/)).not.toBeInTheDocument();
  });
});
