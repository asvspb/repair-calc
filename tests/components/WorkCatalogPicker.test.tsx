/**
 * Tests for WorkCatalogPicker component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkCatalogPicker, catalogToWorkData } from '../../src/components/works/WorkCatalogPicker';
import type { WorkTemplateCatalog, WorkCategory } from '../../src/types/workTemplate';
import type { RoomMetrics } from '../../src/types';

// Mock room metrics
const mockMetrics: RoomMetrics = {
  floorArea: 20,
  netWallArea: 50,
  perimeter: 18,
  skirtingLength: 16,
  volume: 50,
  grossWallArea: 60,
  windowsArea: 5,
  doorsArea: 3,
};

// Mock work template for testing
const mockWorkTemplate: WorkTemplateCatalog = {
  id: 'test-laminate',
  name: 'Укладка ламината',
  unit: 'м²',
  calculationType: 'floorArea',
  category: 'floor' as WorkCategory,
  defaultWorkPrice: 350,
  description: 'Укладка ламината с подложкой',
  difficulty: 'medium',
  estimatedTimePerUnit: 0.5,
  popularity: 95,
  materials: [
    {
      id: 'mat-laminate',
      name: 'Ламинат',
      coveragePerUnit: 2.0,
      wastePercent: 5,
      unit: 'упак',
      defaultPrice: 1200,
      tips: 'Добавьте 5-10% запаса на подрезку',
    },
    {
      id: 'mat-underlay',
      name: 'Подложка',
      coveragePerUnit: 10.0,
      wastePercent: 10,
      unit: 'рулон',
      defaultPrice: 900,
    },
    {
      id: 'mat-skirting',
      name: 'Плинтус',
      isPerimeter: true,
      multiplier: 1.0,
      unit: 'шт',
      packageSize: 2.5,
      wastePercent: 5,
      defaultPrice: 350,
    },
  ],
  tools: [
    {
      id: 'tool-podboyka',
      name: 'Подбойка',
      isRentDefault: false,
      defaultPrice: 500,
    },
    {
      id: 'tool-jigsaw',
      name: 'Электролобзик',
      isRentDefault: true,
      defaultPrice: 500,
      defaultRentPeriod: 1,
    },
  ],
};

describe('catalogToWorkData', () => {
  it('should convert floor area work template correctly', () => {
    const workData = catalogToWorkData(mockWorkTemplate, mockMetrics);

    expect(workData.name).toBe('Укладка ламината');
    expect(workData.unit).toBe('м²');
    expect(workData.calculationType).toBe('floorArea');
    expect(workData.workUnitPrice).toBe(350);
    expect(workData.enabled).toBe(true);
    expect(workData.catalogId).toBe('test-laminate');
  });

  it('should calculate materials by coverage correctly', () => {
    const workData = catalogToWorkData(mockWorkTemplate, mockMetrics);

    // Ламинат: 20 м² / 2.0 м² в упак * 1.05 (5% запас) = 10.5 упак
    const laminate = workData.materials.find((m) => m.name === 'Ламинат');
    expect(laminate).toBeDefined();
    expect(laminate!.quantity).toBeCloseTo(10.5, 1);
    expect(laminate!.unit).toBe('упак');
    expect(laminate!.pricePerUnit).toBe(1200);
  });

  it('should calculate perimeter materials correctly', () => {
    const workData = catalogToWorkData(mockWorkTemplate, mockMetrics);

    // Плинтус: perimeter=18 * 1.0 * 1.05 / 2.5 = 7.56 -> 8 шт
    const skirting = workData.materials.find((m) => m.name === 'Плинтус');
    expect(skirting).toBeDefined();
    expect(skirting!.quantity).toBe(8);
    expect(skirting!.unit).toBe('шт');
  });

  it('should convert tools correctly', () => {
    const workData = catalogToWorkData(mockWorkTemplate, mockMetrics);

    expect(workData.tools).toHaveLength(2);

    const podboyka = workData.tools.find((t) => t.name === 'Подбойка');
    expect(podboyka).toBeDefined();
    expect(podboyka!.isRent).toBe(false);
    expect(podboyka!.price).toBe(500);

    const jigsaw = workData.tools.find((t) => t.name === 'Электролобзик');
    expect(jigsaw).toBeDefined();
    expect(jigsaw!.isRent).toBe(true);
    expect(jigsaw!.rentPeriod).toBe(1);
  });

  it('should handle wall area calculation type', () => {
    const wallTemplate: WorkTemplateCatalog = {
      ...mockWorkTemplate,
      id: 'test-wallpaper',
      name: 'Поклейка обоев',
      calculationType: 'netWallArea',
      category: 'walls' as WorkCategory,
      materials: [
        {
          id: 'mat-wallpaper',
          name: 'Обои',
          coveragePerUnit: 5.3,
          wastePercent: 10,
          unit: 'рулон',
          defaultPrice: 1500,
        },
      ],
      tools: [],
    };

    const workData = catalogToWorkData(wallTemplate, mockMetrics);

    // Обои: 50 м² / 5.3 * 1.10 = 10.38 рулонов
    const wallpaper = workData.materials.find((m) => m.name === 'Обои');
    expect(wallpaper).toBeDefined();
    expect(wallpaper!.quantity).toBeCloseTo(10.38, 0);
  });

  it('should handle consumption rate materials', () => {
    const paintTemplate: WorkTemplateCatalog = {
      ...mockWorkTemplate,
      id: 'test-paint',
      name: 'Покраска стен',
      calculationType: 'netWallArea',
      category: 'walls' as WorkCategory,
      materials: [
        {
          id: 'mat-paint',
          name: 'Краска',
          consumptionRate: 0.006,
          layers: 2,
          wastePercent: 5,
          unit: 'л',
          defaultPrice: 2800,
        },
      ],
      tools: [],
    };

    const workData = catalogToWorkData(paintTemplate, mockMetrics);

    // Краска: 50 * 0.006 * 2 * 1.05 = 0.63 л
    const paint = workData.materials.find((m) => m.name === 'Краска');
    expect(paint).toBeDefined();
    expect(paint!.quantity).toBeCloseTo(0.63, 2);
  });

  it('should handle custom count calculation type', () => {
    const doorTemplate: WorkTemplateCatalog = {
      ...mockWorkTemplate,
      id: 'test-door',
      name: 'Установка двери',
      unit: 'шт',
      calculationType: 'customCount',
      category: 'openings' as WorkCategory,
      materials: [
        {
          id: 'mat-door',
          name: 'Дверной блок',
          coveragePerUnit: 1,
          unit: 'компл',
          defaultPrice: 8000,
        },
      ],
      tools: [],
    };

    const workData = catalogToWorkData(doorTemplate, mockMetrics);

    expect(workData.calculationType).toBe('customCount');
    expect(workData.count).toBe(1);
  });
});

describe('WorkCatalogPicker Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    render(
      <WorkCatalogPicker
        isOpen={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        roomMetrics={mockMetrics}
      />
    );

    expect(screen.queryByText('Каталог работ')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <WorkCatalogPicker
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        roomMetrics={mockMetrics}
      />
    );

    expect(screen.getByText('Каталог работ')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск работы...')).toBeInTheDocument();
  });

  it('should display category filters', () => {
    render(
      <WorkCatalogPicker
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        roomMetrics={mockMetrics}
      />
    );

    // Use getAllBy for categories that appear multiple times (in filter buttons and work cards)
    expect(screen.getByText('Популярные')).toBeInTheDocument();
    expect(screen.getByText('Все')).toBeInTheDocument();
    // Check filter buttons specifically by their button role
    const buttons = screen.getAllByRole('button');
    const categoryButtons = buttons.filter(btn => 
      btn.textContent?.includes('Пол') || 
      btn.textContent?.includes('Стены') ||
      btn.textContent?.includes('Потолок') ||
      btn.textContent?.includes('Проёмы') ||
      btn.textContent?.includes('Прочее')
    );
    expect(categoryButtons.length).toBeGreaterThan(0);
  });

  it('should filter by search query', async () => {
    render(
      <WorkCatalogPicker
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        roomMetrics={mockMetrics}
      />
    );

    const searchInput = screen.getByPlaceholderText('Поиск работы...');
    fireEvent.change(searchInput, { target: { value: 'ламинат' } });

    await waitFor(() => {
      expect(screen.getByText('Укладка ламината')).toBeInTheDocument();
    });
  });

  it('should close on close button click', () => {
    render(
      <WorkCatalogPicker
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        roomMetrics={mockMetrics}
      />
    );

    // Find close button in header
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(
      (btn) => btn.querySelector('svg.lucide-x') || btn.closest('button')?.querySelector('svg')
    );

    if (closeButton) {
      fireEvent.click(closeButton);
    }

    // Alternative: click the "Закрыть" button in footer
    const footerCloseButton = screen.getByText('Закрыть');
    fireEvent.click(footerCloseButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show work details when work is selected', async () => {
    render(
      <WorkCatalogPicker
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        roomMetrics={mockMetrics}
      />
    );

    // Search for laminate to filter works
    const searchInput = screen.getByPlaceholderText('Поиск работы...');
    fireEvent.change(searchInput, { target: { value: 'ламинат' } });

    // Wait for search results
    await waitFor(() => {
      const laminateElements = screen.queryAllByText('Укладка ламината');
      expect(laminateElements.length).toBeGreaterThan(0);
    });

    // Click on laminate work card
    const laminateElements = screen.getAllByText('Укладка ламината');
    fireEvent.click(laminateElements[0]);

    // Should show work details panel with "Добавить работу" button
    await waitFor(() => {
      expect(screen.getByText('Добавить работу')).toBeInTheDocument();
    });
  });

  it('should call onSelect when work is added', async () => {
    render(
      <WorkCatalogPicker
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        roomMetrics={mockMetrics}
      />
    );

    // Search for laminate to filter works
    const searchInput = screen.getByPlaceholderText('Поиск работы...');
    fireEvent.change(searchInput, { target: { value: 'ламинат' } });

    // Wait for search results
    await waitFor(() => {
      const laminateElements = screen.queryAllByText('Укладка ламината');
      expect(laminateElements.length).toBeGreaterThan(0);
    });

    // Click on laminate work card
    const laminateElements = screen.getAllByText('Укладка ламината');
    fireEvent.click(laminateElements[0]);

    // Wait for details panel to show
    await waitFor(() => {
      expect(screen.getByText('Добавить работу')).toBeInTheDocument();
    });

    // Click "Добавить работу"
    const addButton = screen.getByText('Добавить работу');
    fireEvent.click(addButton);

    expect(mockOnSelect).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should display total works count in footer', () => {
    render(
      <WorkCatalogPicker
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        roomMetrics={mockMetrics}
      />
    );

    expect(screen.getByText(/Всего работ в каталоге:/)).toBeInTheDocument();
  });
});