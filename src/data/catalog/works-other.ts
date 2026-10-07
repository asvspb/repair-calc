import type { WorkTemplateCatalog, WorkCategory, Difficulty } from '../../types/workTemplate';
import type { CalculationType } from '@shared/types';
import { TOOLS as tools } from './tools';

export const WORKS_OTHER: WorkTemplateCatalog[] = [
  // ============================================
  // ДОПОЛНИТЕЛЬНЫЕ РАБОТЫ
  // ============================================
  {
    id: 'demolition',
    name: 'Демонтаж',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'other' as WorkCategory,
    defaultWorkPrice: 250,
    description: 'Демонтаж старых покрытий',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.5,
    popularity: 40,
    materials: [
      {
        id: 'mat-garbage-bags',
        name: 'Мешки для мусора',
        consumptionRate: 0.15,
        piecesPerUnit: 10,
        unit: 'упак',
        defaultPrice: 250,
        tips: 'Плотные строительные мешки 120 л',
      },
    ],
    tools: [tools.перфоратор, tools.лом, tools.молоток],
  },

  {
    id: 'electrical',
    name: 'Электрика',
    unit: 'точка',
    calculationType: 'customCount' as CalculationType,
    category: 'other' as WorkCategory,
    defaultWorkPrice: 2000,
    description: 'Монтаж электроточек (розетки, выключатели)',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 1.5,
    popularity: 55,
    materials: [
      {
        id: 'mat-cable',
        name: 'Кабель ВВГнг 3×2.5',
        coveragePerUnit: 4,
        wastePercent: 15,
        unit: 'м',
        defaultPrice: 75,
        tips: 'В среднем 4 м кабеля на точку. Для розеток 3×2.5, для света 3×1.5',
      },
      {
        id: 'mat-socket-box',
        name: 'Подрозетник',
        coveragePerUnit: 1,
        wastePercent: 5,
        unit: 'шт',
        defaultPrice: 45,
        tips: 'Стандарт d68 мм для бетонных стен',
      },
      {
        id: 'mat-socket',
        name: 'Розетка/выключатель',
        coveragePerUnit: 1,
        wastePercent: 0,
        unit: 'шт',
        defaultPrice: 450,
        tips: 'Встроенный механизм + рамка. Бюджетные от 200 ₽, средние 400-600 ₽',
      },
    ],
    tools: [tools.перфоратор, tools.тестер],
  },

  {
    id: 'plumbing',
    name: 'Сантехника',
    unit: 'точка',
    calculationType: 'customCount' as CalculationType,
    category: 'other' as WorkCategory,
    defaultWorkPrice: 3500,
    description: 'Монтаж сантехнических точек',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 3,
    popularity: 50,
    materials: [
      {
        id: 'mat-pipe',
        name: 'Трубы PPR',
        coveragePerUnit: 2.5,
        wastePercent: 15,
        unit: 'м',
        defaultPrice: 180,
        tips: 'В среднем 2.5 м на точку. Диаметр 20 или 25 мм',
      },
      {
        id: 'mat-fittings',
        name: 'Фитинги',
        coveragePerUnit: 1,
        wastePercent: 10,
        unit: 'компл',
        defaultPrice: 450,
        tips: 'Уголки, муфты, тройники в среднем на одну точку',
      },
    ],
    tools: [tools.трубогиб, tools.паяльникДляТруб, tools.ключи],
  },
];
