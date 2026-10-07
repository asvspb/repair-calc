import type { WorkTemplateCatalog, WorkCategory, Difficulty } from '../../types/workTemplate';
import type { CalculationType } from '@shared/types';
import { TOOLS as tools } from './tools';

export const WORKS_OPENINGS: WorkTemplateCatalog[] = [
  // ============================================
  // ПРОЁМЫ
  // ============================================
  {
    id: 'install-door',
    name: 'Установка двери',
    unit: 'шт',
    calculationType: 'customCount' as CalculationType,
    category: 'openings' as WorkCategory,
    defaultWorkPrice: 5500,
    description: 'Установка межкомнатной двери с наличниками',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 4,
    popularity: 85,
    materials: [
      {
        id: 'mat-door-block',
        name: 'Дверной блок',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'компл',
        defaultPrice: 12000,
        tips: 'Включает полотно, коробку, наличники',
      },
      {
        id: 'mat-door-handle',
        name: 'Ручка дверная',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'шт',
        defaultPrice: 1200,
      },
      {
        id: 'mat-door-lock',
        name: 'Замок/защёлка',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'шт',
        defaultPrice: 800,
      },
      {
        id: 'mat-foam-door',
        name: 'Монтажная пена',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'баллон',
        defaultPrice: 350,
      },
    ],
    tools: [tools.уровень, tools.пила, tools.шуруповёрт, tools.монтажнаяПена],
  },

  {
    id: 'install-window',
    name: 'Установка окна',
    unit: 'шт',
    calculationType: 'customCount' as CalculationType,
    category: 'openings' as WorkCategory,
    defaultWorkPrice: 6500,
    description: 'Установка окна с подоконником и отливом',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 5,
    popularity: 60,
    materials: [
      {
        id: 'mat-window-block',
        name: 'Оконный блок',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'шт',
        defaultPrice: 12000,
        tips: 'Цена зависит от размера и профиля',
      },
      {
        id: 'mat-windowsill',
        name: 'Подоконник',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'шт',
        defaultPrice: 1500,
      },
      {
        id: 'mat-ebb',
        name: 'Отлив',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'шт',
        defaultPrice: 600,
      },
      {
        id: 'mat-foam-window',
        name: 'Монтажная пена',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'баллон',
        defaultPrice: 350,
      },
    ],
    tools: [tools.уровень, tools.шуруповёрт, tools.пила],
  },

  {
    id: 'slopes',
    name: 'Откосы',
    unit: 'пог. м',
    calculationType: 'skirtingLength' as CalculationType,
    category: 'openings' as WorkCategory,
    defaultWorkPrice: 550,
    description: 'Монтаж откосов оконных/дверных проёмов',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.5,
    popularity: 50,
    materials: [
      {
        id: 'mat-slope-panel',
        name: 'Панель откосная',
        coveragePerUnit: 0.3,
        wastePercent: 10,
        unit: 'шт',
        defaultPrice: 300,
        tips: 'Или гипсокартон/штукатурка',
      },
      {
        id: 'mat-corner-profile',
        name: 'Уголок',
        coveragePerUnit: 1,
        wastePercent: 10,
        unit: 'пог. м',
        defaultPrice: 80,
      },
    ],
    tools: [tools.ножЛинолеум, tools.шуруповёрт, tools.уровень],
  },
];
