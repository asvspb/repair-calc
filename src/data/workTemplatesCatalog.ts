/**
 * Каталог типовых работ для ремонта
 * Содержит ~20 работ с материалами, инструментами и параметрами расчёта
 */

import type {
  WorkTemplateCatalog,
  MaterialTemplate,
  ToolTemplate,
  WorkCategory,
  Difficulty,
} from '../types/workTemplate';
import type { CalculationType } from '../types/index';

// ============================================
// ИНСТРУМЕНТЫ (переиспользуемые)
// ============================================

const tools = {
  // Пол
  подбойка: { id: 'tool-podboyka', name: 'Подбойка для ламината', isRentDefault: false, defaultPrice: 500 } as ToolTemplate,
  клинья: { id: 'tool-wedges', name: 'Клинья распорные', isRentDefault: false, defaultPrice: 150 } as ToolTemplate,
  лобзик: { id: 'tool-jigsaw', name: 'Электролобзик', isRentDefault: true, defaultPrice: 500, defaultRentPeriod: 1 } as ToolTemplate,
  плиткорез: { id: 'tool-tile-cutter', name: 'Плиткорез', isRentDefault: true, defaultPrice: 800, defaultRentPeriod: 1 } as ToolTemplate,
  шпательЗубчатый: { id: 'tool-notched-trowel', name: 'Шпатель зубчатый', isRentDefault: false, defaultPrice: 300 } as ToolTemplate,
  тёрка: { id: 'tool-grout-float', name: 'Тёрка резиновая', isRentDefault: false, defaultPrice: 250 } as ToolTemplate,
  миксер: { id: 'tool-mixer', name: 'Миксер (насадка)', isRentDefault: false, defaultPrice: 400 } as ToolTemplate,
  правилоНаливной: { id: 'tool-screed-rule', name: 'Правило', isRentDefault: false, defaultPrice: 800 } as ToolTemplate,
  валикИгольчатый: { id: 'tool-needle-roller', name: 'Валик игольчатый', isRentDefault: false, defaultPrice: 350 } as ToolTemplate,
  ножЛинолеум: { id: 'tool-linoleum-knife', name: 'Нож для линолеума', isRentDefault: false, defaultPrice: 300 } as ToolTemplate,
  шпательЛинолеум: { id: 'tool-linoleum-trowel', name: 'Шпатель для клея', isRentDefault: false, defaultPrice: 250 } as ToolTemplate,
  
  // Стены
  валикОбойный: { id: 'tool-wallpaper-roller', name: 'Валик обойный', isRentDefault: false, defaultPrice: 200 } as ToolTemplate,
  кистьОбойная: { id: 'tool-wallpaper-brush', name: 'Кисть для клея', isRentDefault: false, defaultPrice: 150 } as ToolTemplate,
  ножОбойный: { id: 'tool-wallpaper-knife', name: 'Нож обойный', isRentDefault: false, defaultPrice: 200 } as ToolTemplate,
  валикМалярный: { id: 'tool-paint-roller', name: 'Валик малярный', isRentDefault: false, defaultPrice: 300 } as ToolTemplate,
  кистьМалярная: { id: 'tool-paint-brush', name: 'Кисть малярная', isRentDefault: false, defaultPrice: 150 } as ToolTemplate,
  ванночкаКраски: { id: 'tool-paint-tray', name: 'Ванночка для краски', isRentDefault: false, defaultPrice: 150 } as ToolTemplate,
  скотчМалярный: { id: 'tool-painters-tape', name: 'Скотч малярный', isRentDefault: false, defaultPrice: 100 } as ToolTemplate,
  правилоШтукатурка: { id: 'tool-plaster-rule', name: 'Правило алюминиевое', isRentDefault: false, defaultPrice: 1200 } as ToolTemplate,
  шпатели: { id: 'tool-spacles', name: 'Набор шпателей', isRentDefault: false, defaultPrice: 600 } as ToolTemplate,
  тёркаШпаклёвка: { id: 'tool-putty-float', name: 'Тёрка шлифовальная', isRentDefault: false, defaultPrice: 300 } as ToolTemplate,
  шуруповёрт: { id: 'tool-screwdriver', name: 'Шуруповёрт', isRentDefault: true, defaultPrice: 400, defaultRentPeriod: 1 } as ToolTemplate,
  уровень: { id: 'tool-level', name: 'Уровень пузырьковый', isRentDefault: false, defaultPrice: 500 } as ToolTemplate,
  ножовка: { id: 'tool-handsaw', name: 'Ножовка', isRentDefault: false, defaultPrice: 400 } as ToolTemplate,
  
  // Потолок
  валикСУдлинителем: { id: 'tool-ceiling-roller', name: 'Валик с удлинителем', isRentDefault: false, defaultPrice: 600 } as ToolTemplate,
  ножницыПоМеталлу: { id: 'tool-metal-shears', name: 'Ножницы по металлу', isRentDefault: false, defaultPrice: 600 } as ToolTemplate,
  
  // Проёмы
  пила: { id: 'tool-saw', name: 'Пила', isRentDefault: false, defaultPrice: 500 } as ToolTemplate,
  монтажнаяПена: { id: 'tool-foam-gun', name: 'Пистолет для пены', isRentDefault: false, defaultPrice: 400 } as ToolTemplate,
  
  // Демонтаж
  перфоратор: { id: 'tool-demolition-hammer', name: 'Перфоратор', isRentDefault: true, defaultPrice: 1000, defaultRentPeriod: 1 } as ToolTemplate,
  лом: { id: 'tool-crowbar', name: 'Лом', isRentDefault: false, defaultPrice: 400 } as ToolTemplate,
  молоток: { id: 'tool-hammer', name: 'Молоток', isRentDefault: false, defaultPrice: 300 } as ToolTemplate,
  
  // Электрика/Сантехника
  тестер: { id: 'tool-tester', name: 'Тестер (мультиметр)', isRentDefault: false, defaultPrice: 500 } as ToolTemplate,
  трубогиб: { id: 'tool-pipe-bender', name: 'Трубогиб', isRentDefault: true, defaultPrice: 400, defaultRentPeriod: 1 } as ToolTemplate,
  паяльникДляТруб: { id: 'tool-pipe-welder', name: 'Паяльник для труб', isRentDefault: true, defaultPrice: 500, defaultRentPeriod: 1 } as ToolTemplate,
  ключи: { id: 'tool-wrenches', name: 'Набор ключей', isRentDefault: false, defaultPrice: 1500 } as ToolTemplate,
};

// ============================================
// КАТАЛОГ РАБОТ
// ============================================

export const WORK_TEMPLATES_CATALOG: WorkTemplateCatalog[] = [
  // ============================================
  // ПОЛ (напольные покрытия)
  // ============================================
  {
    id: 'laminate-flooring',
    name: 'Укладка ламината',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'floor' as WorkCategory,
    defaultWorkPrice: 450,
    description: 'Укладка ламината с подложкой и монтажом плинтуса',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.5,
    popularity: 95,
    materials: [
      {
        id: 'mat-laminate',
        name: 'Ламинат',
        coveragePerUnit: 2.13,
        wastePercent: 7,
        unit: 'упак',
        defaultPrice: 1400,
        tips: 'Стандартная упаковка ~2.13 м² (8 плашек). Добавьте 7-10% запаса на подрезку',
      },
      {
        id: 'mat-underlay',
        name: 'Подложка',
        coveragePerUnit: 15.0,
        wastePercent: 5,
        unit: 'рулон',
        defaultPrice: 1100,
        tips: 'Стандартный рулон 10м×1.5м = 15 м². Выбирайте толщину 2-3 мм',
      },
      {
        id: 'mat-skirting',
        name: 'Плинтус',
        isPerimeter: true,
        multiplier: 1.0,
        unit: 'шт',
        packageSize: 2.5,
        wastePercent: 10,
        defaultPrice: 350,
        tips: 'Длина плинтуса 2.5 м. Добавьте 10% на углы и стыки',
      },
      {
        id: 'mat-skirting-fasteners',
        name: 'Крепёж для плинтуса',
        isPerimeter: true,
        multiplier: 1.5,
        unit: 'шт',
        piecesPerUnit: 50,
        defaultPrice: 150,
      },
    ],
    tools: [tools.подбойка, tools.клинья, tools.лобзик, tools.уровень],
  },

  {
    id: 'tile-flooring',
    name: 'Укладка плитки (пол)',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'floor' as WorkCategory,
    defaultWorkPrice: 1100,
    description: 'Укладка напольной плитки с затиркой швов',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 1.0,
    popularity: 80,
    materials: [
      {
        id: 'mat-floor-tile',
        name: 'Плитка напольная',
        coveragePerUnit: 1.0,
        wastePercent: 12,
        unit: 'м²',
        defaultPrice: 1500,
        tips: 'Добавьте 12-15% запаса на подрезку и бой',
      },
      {
        id: 'mat-tile-adhesive',
        name: 'Клей для плитки',
        consumptionRate: 0.005,
        wastePercent: 5,
        unit: 'мешок',
        packageSize: 25,
        defaultPrice: 550,
        tips: 'Расход: ~5 кг/м² при слое 5 мм (зависит от размера зуба шпателя)',
      },
      {
        id: 'mat-grout',
        name: 'Затирка для швов',
        consumptionRate: 0.0004,
        wastePercent: 10,
        unit: 'кг',
        packageSize: 2,
        defaultPrice: 250,
        tips: 'Расход ~0.3-0.5 кг/м² в зависимости от размера плитки и ширины шва',
      },
      {
        id: 'mat-primer-floor',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
        tips: 'Расход: ~0.1 л/м² в 1 слой. Глубокого проникновения для пола',
      },
      {
        id: 'mat-tile-spacers',
        name: 'Крестики для плитки',
        piecesPerUnit: 200,
        consumptionRate: 0.04,
        unit: 'упак',
        defaultPrice: 100,
      },
    ],
    tools: [tools.плиткорез, tools.шпательЗубчатый, tools.тёрка, tools.уровень, tools.миксер],
  },

  {
    id: 'linoleum-flooring',
    name: 'Укладка линолеума',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'floor' as WorkCategory,
    defaultWorkPrice: 300,
    description: 'Укладка линолеума с креплением плинтусом',
    difficulty: 'easy' as Difficulty,
    estimatedTimePerUnit: 0.3,
    popularity: 70,
    materials: [
      {
        id: 'mat-linoleum',
        name: 'Линолеум',
        coveragePerUnit: 1.0,
        wastePercent: 10,
        unit: 'м²',
        defaultPrice: 750,
        tips: 'При ширине рулона 3-4 м добавьте 10% запас. Для помещения 14 м² берите рулон шириной 4 м',
      },
      {
        id: 'mat-linoleum-adhesive',
        name: 'Клей для линолеума',
        consumptionRate: 0.005,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 450,
        tips: 'Расход ~0.4-0.5 л/м². Для помещений более 20 м² обязателен',
      },
      {
        id: 'mat-skirting-linoleum',
        name: 'Плинтус',
        isPerimeter: true,
        multiplier: 1.0,
        unit: 'шт',
        packageSize: 2.5,
        wastePercent: 5,
        defaultPrice: 350,
      },
    ],
    tools: [tools.ножЛинолеум, tools.шпательЛинолеум],
  },

  {
    id: 'screed-floor',
    name: 'Заливка стяжки',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'floor' as WorkCategory,
    defaultWorkPrice: 550,
    description: 'Выравнивание пола самовыравнивающейся смесью',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.5,
    popularity: 60,
    materials: [
      {
        id: 'mat-screed-mix',
        name: 'Смесь для стяжки',
        consumptionRate: 0.02,
        wastePercent: 5,
        unit: 'мешок',
        packageSize: 25,
        defaultPrice: 420,
        tips: 'Расход: ~20 кг/м² при толщине 1 см. Стандартная толщина 3-5 см',
      },
      {
        id: 'mat-primer-screed',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
      {
        id: 'mat-beacons',
        name: 'Маяки',
        isPerimeter: true,
        multiplier: 0.4,
        unit: 'шт',
        defaultPrice: 60,
        tips: 'Шаг маяков 80-100 см. Длина маяка 3 м',
      },
    ],
    tools: [tools.правилоНаливной, tools.валикИгольчатый, tools.миксер, tools.уровень],
  },

  // ============================================
  // СТЕНЫ (отделка)
  // ============================================
  {
    id: 'wallpaper-walls',
    name: 'Поклейка обоев',
    unit: 'м²',
    calculationType: 'netWallArea' as CalculationType,
    category: 'walls' as WorkCategory,
    defaultWorkPrice: 350,
    description: 'Поклейка обоев с подготовкой поверхности',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.4,
    popularity: 90,
    materials: [
      {
        id: 'mat-wallpaper',
        name: 'Обои',
        coveragePerUnit: 5.3,
        wastePercent: 15,
        unit: 'рулон',
        defaultPrice: 1800,
        tips: 'Рулон 10.05м×0.53м. Для обоев с раппортом добавьте 20-25% на подгонку рисунка',
      },
      {
        id: 'mat-wallpaper-glue',
        name: 'Клей для обоев',
        consumptionRate: 0.02,
        wastePercent: 5,
        unit: 'пачка',
        packageSize: 0.25,
        defaultPrice: 220,
        tips: 'Пачка 250г на 7-8 рулонов. Для флизелиновых берите специальный клей',
      },
      {
        id: 'mat-primer-walls',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
    ],
    tools: [tools.валикОбойный, tools.кистьОбойная, tools.ножОбойный, tools.уровень, tools.шпатели],
  },

  {
    id: 'paint-walls',
    name: 'Покраска стен',
    unit: 'м²',
    calculationType: 'netWallArea' as CalculationType,
    category: 'walls' as WorkCategory,
    defaultWorkPrice: 300,
    description: 'Покраска стен в 2-3 слоя',
    difficulty: 'easy' as Difficulty,
    estimatedTimePerUnit: 0.3,
    popularity: 85,
    materials: [
      {
        id: 'mat-paint-walls',
        name: 'Краска',
        consumptionRate: 0.12,
        layers: 2,
        wastePercent: 7,
        unit: 'л',
        packageSize: 10,
        defaultPrice: 3200,
        tips: 'Расход: ~0.1-0.12 л/м² в один слой. Для 2 слоёв умножить на 2',
      },
      {
        id: 'mat-primer-paint',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
    ],
    tools: [tools.валикМалярный, tools.кистьМалярная, tools.ванночкаКраски, tools.скотчМалярный],
  },

  {
    id: 'plaster-walls',
    name: 'Штукатурка стен',
    unit: 'м²',
    calculationType: 'netWallArea' as CalculationType,
    category: 'walls' as WorkCategory,
    defaultWorkPrice: 550,
    description: 'Выравнивание стен штукатуркой',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 1.0,
    popularity: 65,
    materials: [
      {
        id: 'mat-plaster',
        name: 'Штукатурка',
        consumptionRate: 0.009,
        wastePercent: 5,
        unit: 'мешок',
        packageSize: 30,
        defaultPrice: 480,
        tips: 'Расход: ~8.5-9 кг/м² при толщине 1 см. Средний слой 1.5-2 см',
      },
      {
        id: 'mat-primer-plaster',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
      {
        id: 'mat-beacons-walls',
        name: 'Маяки штукатурные',
        isPerimeter: true,
        multiplier: 0.35,
        unit: 'шт',
        defaultPrice: 50,
        tips: 'Шаг маяков 1-1.2 м. Длина маяка 3 м',
      },
    ],
    tools: [tools.правилоШтукатурка, tools.шпатели, tools.миксер, tools.уровень],
  },

  {
    id: 'putty-walls',
    name: 'Шпаклёвка стен',
    unit: 'м²',
    calculationType: 'netWallArea' as CalculationType,
    category: 'walls' as WorkCategory,
    defaultWorkPrice: 280,
    description: 'Финишное выравнивание стен шпаклёвкой',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.5,
    popularity: 70,
    materials: [
      {
        id: 'mat-putty',
        name: 'Шпаклёвка',
        consumptionRate: 1.2,
        wastePercent: 5,
        unit: 'кг',
        packageSize: 20,
        defaultPrice: 420,
        tips: 'Расход: ~1-1.2 кг/м² при толщине 1 мм. Обычно 2-3 слоя по 0.5 мм',
      },
      {
        id: 'mat-primer-putty',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
    ],
    tools: [tools.шпатели, tools.тёркаШпаклёвка, tools.миксер],
  },

  {
    id: 'tile-walls',
    name: 'Укладка плитки (стены)',
    unit: 'м²',
    calculationType: 'netWallArea' as CalculationType,
    category: 'walls' as WorkCategory,
    defaultWorkPrice: 1200,
    description: 'Облицовка стен плиткой (ванная, кухня)',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 1.2,
    popularity: 75,
    materials: [
      {
        id: 'mat-wall-tile',
        name: 'Плитка настенная',
        coveragePerUnit: 1.0,
        wastePercent: 12,
        unit: 'м²',
        defaultPrice: 1300,
        tips: 'Добавьте 12-15% запаса на подрезку и бой',
      },
      {
        id: 'mat-tile-adhesive-wall',
        name: 'Клей для плитки',
        consumptionRate: 0.004,
        wastePercent: 5,
        unit: 'мешок',
        packageSize: 25,
        defaultPrice: 550,
        tips: 'Расход ~4 кг/м². Для крупноформатной плитки расход выше',
      },
      {
        id: 'mat-grout-wall',
        name: 'Затирка для швов',
        consumptionRate: 0.0004,
        wastePercent: 10,
        unit: 'кг',
        packageSize: 2,
        defaultPrice: 280,
        tips: 'Расход зависит от формата плитки и ширины шва',
      },
      {
        id: 'mat-primer-tile',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
    ],
    tools: [tools.плиткорез, tools.шпательЗубчатый, tools.тёрка, tools.уровень, tools.миксер],
  },

  {
    id: 'panel-walls',
    name: 'Облицовка панелями',
    unit: 'м²',
    calculationType: 'netWallArea' as CalculationType,
    category: 'walls' as WorkCategory,
    defaultWorkPrice: 650,
    description: 'Облицовка стен декоративными панелями на обрешётке',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.6,
    popularity: 55,
    materials: [
      {
        id: 'mat-panels',
        name: 'Панели стеновые',
        coveragePerUnit: 0.72,
        wastePercent: 10,
        unit: 'шт',
        defaultPrice: 550,
        tips: 'Размер панели 3м×0.24м = 0.72 м². ПВХ панели для ванной/кухни',
      },
      {
        id: 'mat-batten-horizontal',
        name: 'Брусок 50×30 мм (обрешётка)',
        isPerimeter: true,
        multiplier: 3.0,
        wastePercent: 10,
        unit: 'пог. м',
        defaultPrice: 95,
        tips: 'Шаг обрешётки 40-50 см по вертикали',
      },
      {
        id: 'mat-screws-panel',
        name: 'Саморезы',
        consumptionRate: 0.15,
        piecesPerUnit: 200,
        unit: 'упак',
        defaultPrice: 350,
      },
      {
        id: 'mat-corners-panel',
        name: 'Уголки декоративные',
        isPerimeter: true,
        multiplier: 0.15,
        unit: 'шт',
        defaultPrice: 180,
        tips: 'Длина уголка 3 м',
      },
    ],
    tools: [tools.шуруповёрт, tools.лобзик, tools.уровень, tools.ножовка],
  },

  // ============================================
  // ПОТОЛОК
  // ============================================
  {
    id: 'plaster-ceiling',
    name: 'Выравнивание потолка',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'ceiling' as WorkCategory,
    defaultWorkPrice: 700,
    description: 'Выравнивание потолка штукатуркой по маякам',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 1.2,
    popularity: 45,
    materials: [
      {
        id: 'mat-plaster-ceiling',
        name: 'Штукатурка',
        consumptionRate: 0.009,
        wastePercent: 5,
        unit: 'мешок',
        packageSize: 30,
        defaultPrice: 480,
        tips: 'Расход: ~8.5-9 кг/м² при толщине 1 см. Для потолка слой обычно 1-1.5 см',
      },
      {
        id: 'mat-primer-plaster-ceiling',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
      {
        id: 'mat-beacons-ceiling',
        name: 'Маяки штукатурные',
        isPerimeter: true,
        multiplier: 0.4,
        unit: 'шт',
        defaultPrice: 50,
        tips: 'Шаг маяков 1-1.2 м. Длина маяка 3 м',
      },
    ],
    tools: [tools.правилоШтукатурка, tools.шпатели, tools.миксер, tools.уровень],
  },

  {
    id: 'putty-ceiling',
    name: 'Шпаклёвка потолка',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'ceiling' as WorkCategory,
    defaultWorkPrice: 350,
    description: 'Финишное выравнивание потолка шпаклёвкой',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.6,
    popularity: 55,
    materials: [
      {
        id: 'mat-putty-ceiling',
        name: 'Шпаклёвка',
        consumptionRate: 1.2,
        wastePercent: 5,
        unit: 'кг',
        packageSize: 20,
        defaultPrice: 420,
        tips: 'Расход: ~1-1.2 кг/м² при толщине 1 мм. Обычно 2-3 слоя',
      },
      {
        id: 'mat-primer-putty-ceiling',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
    ],
    tools: [tools.шпатели, tools.тёркаШпаклёвка, tools.миксер, tools.валикСУдлинителем],
  },

  {
    id: 'paint-ceiling',
    name: 'Покраска потолка',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'ceiling' as WorkCategory,
    defaultWorkPrice: 350,
    description: 'Покраска потолка в 2-3 слоя',
    difficulty: 'medium' as Difficulty,
    estimatedTimePerUnit: 0.4,
    popularity: 80,
    materials: [
      {
        id: 'mat-paint-ceiling',
        name: 'Краска потолочная',
        consumptionRate: 0.14,
        layers: 2,
        wastePercent: 7,
        unit: 'л',
        packageSize: 10,
        defaultPrice: 3000,
        tips: 'Расход ~0.12-0.14 л/м² в один слой. Белая матовая для потолка',
      },
      {
        id: 'mat-primer-ceiling',
        name: 'Грунтовка',
        consumptionRate: 0.01,
        wastePercent: 5,
        unit: 'л',
        packageSize: 5,
        defaultPrice: 280,
      },
    ],
    tools: [tools.валикСУдлинителем, tools.кистьМалярная, tools.ванночкаКраски],
  },

  {
    id: 'stretch-ceiling',
    name: 'Натяжной потолок',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'ceiling' as WorkCategory,
    defaultWorkPrice: 650,
    description: 'Монтаж натяжного потолка (под ключ)',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 0.2,
    popularity: 70,
    materials: [
      {
        id: 'mat-stretch-canvas',
        name: 'Полотно натяжное',
        coveragePerUnit: 1.0,
        wastePercent: 0,
        unit: 'м²',
        defaultPrice: 650,
        tips: 'Цена обычно включает монтаж под ключ',
      },
    ],
    tools: [], // Монтаж специалистами
  },

  {
    id: 'gypsum-ceiling',
    name: 'Потолок из ГКЛ',
    unit: 'м²',
    calculationType: 'floorArea' as CalculationType,
    category: 'ceiling' as WorkCategory,
    defaultWorkPrice: 900,
    description: 'Подвесной потолок из гипсокартона',
    difficulty: 'hard' as Difficulty,
    estimatedTimePerUnit: 1.5,
    popularity: 50,
    materials: [
      {
        id: 'mat-gypsum-board',
        name: 'ГКЛ (потолочный)',
        coveragePerUnit: 3.0,
        wastePercent: 10,
        unit: 'лист',
        defaultPrice: 520,
        tips: 'Размер листа 2.5×1.2 м = 3 м². Толщина 9.5 мм для потолка',
      },
      {
        id: 'mat-profile-ceiling',
        name: 'Профиль потолочный CD60',
        isPerimeter: true,
        multiplier: 1.2,
        wastePercent: 10,
        unit: 'пог. м',
        defaultPrice: 95,
        tips: 'Шаг профиля 40 см. Также нужен UD профиль по периметру',
      },
      {
        id: 'mat-hangers',
        name: 'Подвесы',
        consumptionRate: 0.7,
        piecesPerUnit: 50,
        unit: 'упак',
        defaultPrice: 220,
        tips: 'Шаг подвесов 60-80 см',
      },
      {
        id: 'mat-screws-gypsum',
        name: 'Саморезы для ГКЛ',
        consumptionRate: 0.25,
        piecesPerUnit: 200,
        unit: 'упак',
        defaultPrice: 280,
      },
      {
        id: 'mat-serpyanka',
        name: 'Лента-серпянка',
        isPerimeter: true,
        multiplier: 0.4,
        unit: 'рулон',
        defaultPrice: 180,
        tips: 'Для швов ГКЛ. Рулон 45 м',
      },
    ],
    tools: [tools.шуруповёрт, tools.ножницыПоМеталлу, tools.уровень],
  },

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

// ============================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С КАТАЛОГОМ
// ============================================

/**
 * Получить работы по категории
 */
export function getWorksByCategory(category: WorkCategory): WorkTemplateCatalog[] {
  return WORK_TEMPLATES_CATALOG.filter((work) => work.category === category);
}

/**
 * Получить все категории с работами
 */
export function getCategoriesWithWorks(): Record<WorkCategory, WorkTemplateCatalog[]> {
  return {
    floor: getWorksByCategory('floor'),
    walls: getWorksByCategory('walls'),
    ceiling: getWorksByCategory('ceiling'),
    openings: getWorksByCategory('openings'),
    other: getWorksByCategory('other'),
  };
}

/**
 * Найти работу по ID
 */
export function getWorkById(id: string): WorkTemplateCatalog | undefined {
  return WORK_TEMPLATES_CATALOG.find((work) => work.id === id);
}

/**
 * Поиск работ по названию
 */
export function searchWorks(query: string): WorkTemplateCatalog[] {
  const lowerQuery = query.toLowerCase();
  return WORK_TEMPLATES_CATALOG.filter(
    (work) =>
      work.name.toLowerCase().includes(lowerQuery) ||
      work.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Получить популярные работы (топ по popularity)
 */
export function getPopularWorks(limit: number = 5): WorkTemplateCatalog[] {
  return [...WORK_TEMPLATES_CATALOG]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, limit);
}

/**
 * Экспорт типов для использования в других модулях
 */
export type { WorkTemplateCatalog, MaterialTemplate, ToolTemplate };