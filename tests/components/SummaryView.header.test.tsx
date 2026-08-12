import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SummaryView } from '../../src/components/SummaryView';
import type { ProjectData, RoomData } from '../../shared/types';
import i18n from '../../src/i18n';
import { I18nextProvider } from 'react-i18next';

// Mock dependencies correctly
vi.mock('../../src/domain/pricing/costs', () => ({
  calculateRoomCosts: vi.fn(() => ({
    totalWork: 100,
    totalMaterial: 50,
    totalTools: 0,
    total: 150,
  })),
}));

describe('SummaryView header logic', () => {
  beforeEach(() => {
    // Reset language to RU for stable tests
    i18n.changeLanguage('ru');
  });

  const getMockProject = (name?: string, objectsCount: number = 1): ProjectData => {
    const objects = Array.from({ length: objectsCount }, (_, i) => ({
      id: `o${i}`,
      name: `Object ${i}`,
      rooms: [] as RoomData[],
    }));
    return {
      id: 'p1',
      name: name ?? '',
      clientName: '',
      createdAt: 0,
      updatedAt: 0,
      rooms: [],
      objects,
    } as unknown as ProjectData;
  };

  const mockOnRoomClick = vi.fn();

  const renderWithI18n = (ui: React.ReactElement) => {
    return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
  };

  it('1. scope=project, project.name="Мои квартиры" -> Смета проекта «Мои квартиры»', () => {
    const project = getMockProject('Мои квартиры');
    renderWithI18n(
      <SummaryView
        project={project}
        scope="project"
        activeObjectId={null}
        onRoomClick={mockOnRoomClick}
      />,
    );

    // Checking for the exact translated string
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(
      'Смета проекта «Мои квартиры»',
    );
  });

  it('2. project.name="" -> Смета проекта without quotes', () => {
    const project = getMockProject('');
    renderWithI18n(
      <SummaryView
        project={project}
        scope="project"
        activeObjectId={null}
        onRoomClick={mockOnRoomClick}
      />,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Смета проекта');
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toContain('«');
  });

  it('3. project.name=undefined -> Смета проекта', () => {
    const project = getMockProject();
    // Simulate undefined name, though ProjectData.name is typed as string
    (project as any).name = undefined;
    renderWithI18n(
      <SummaryView
        project={project}
        scope="project"
        activeObjectId={null}
        onRoomClick={mockOnRoomClick}
      />,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Смета проекта');
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toContain('«');
  });

  it('4. scope=project, 2 objects -> badge (2 объекта) is present', () => {
    const project = getMockProject('Test', 2);
    renderWithI18n(
      <SummaryView
        project={project}
        scope="project"
        groupByObject={true}
        activeObjectId={null}
        onRoomClick={mockOnRoomClick}
      />,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('(2 объекта)');
  });

  it('5. Regression: scope=object -> header does not contain "Смета проекта"', () => {
    const project = getMockProject('Test Project', 1);
    project.objects![0].name = 'Квартира 1';

    renderWithI18n(
      <SummaryView
        project={project}
        scope="object"
        activeObjectId="o0"
        onRoomClick={mockOnRoomClick}
      />,
    );

    const textContent = screen.getByRole('heading', { level: 2 }).textContent;
    expect(textContent).toContain('Смета объекта Квартира 1');
    expect(textContent).not.toContain('Смета проекта');
  });
});
