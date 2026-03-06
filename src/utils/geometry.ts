import type { RoomData, RoomSubSection, RoomMetrics } from '../types';

/**
 * Calculate metrics for a room subsection based on its shape
 */
export function calculateSectionMetrics(section: RoomSubSection): { area: number; perimeter: number } {
  const shape = section.shape || 'rectangle'; // Default to rectangle for backward compatibility

  switch (shape) {
    case 'rectangle': {
      const area = section.length * section.width;
      const perimeter = (section.length + section.width) * 2;
      return { area, perimeter };
    }

    case 'trapezoid': {
      // Площадь трапеции: (base1 + base2) * depth / 2
      // Периметр: base1 + base2 + side1 + side2
      const base1 = section.base1 || 0;
      const base2 = section.base2 || 0;
      const depth = section.depth || 0;
      const side1 = section.side1 || 0;
      const side2 = section.side2 || 0;
      const area = (base1 + base2) * depth / 2;
      const perimeter = base1 + base2 + side1 + side2;
      return { area, perimeter };
    }

    case 'triangle': {
      // Формула Герона для площади по трём сторонам
      const a = section.sideA || 0;
      const b = section.sideB || 0;
      const c = section.sideC || 0;

      if (a > 0 && b > 0 && c > 0) {
        // Проверка треугольника: сумма любых двух сторон больше третьей
        if (a + b > c && a + c > b && b + c > a) {
          const s = (a + b + c) / 2; // полупериметр
          const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
          const perimeter = a + b + c;
          return { area, perimeter };
        }
      }

      // Fallback: base × height / 2 (если есть base и height)
      const base = section.length || 0;
      const height = section.width || 0;
      const area = base * height / 2;
      // Для прямоугольного треугольника: perimeter = base + height + sqrt(base² + height²)
      const perimeter = base + height + Math.sqrt(base * base + height * height);
      return { area, perimeter };
    }

    case 'parallelogram': {
      // Площадь: base × depth
      // Периметр: 2 × (base + side)
      const base = section.base || section.length || 0;
      const depth = section.depth || section.width || 0;
      const side = section.side || 0;
      const area = base * depth;
      const perimeter = 2 * (base + side);
      return { area, perimeter };
    }

    default:
      return { area: 0, perimeter: 0 };
  }
}

/**
 * Calculate room metrics (floor area, perimeter, wall area, etc.)
 */
export function calculateRoomMetrics(room: RoomData): RoomMetrics {
  // Базовые расчеты
  let floorArea = room.length * room.width;
  let perimeter = (room.length + room.width) * 2;
  let grossWallArea = perimeter * room.height;

  // Гарантируем, что массивы существуют
  const segments = room.segments || [];
  const obstacles = room.obstacles || [];
  const wallSections = room.wallSections || [];
  const subSections = room.subSections || [];
  const windows = room.windows || [];
  const doors = room.doors || [];

  // Расширенный режим: секции (подпомещения)
  if (room.geometryMode === 'extended') {
    // Каждая секция может иметь разную форму
    // Площадь пола = сумма площадей всех секций
    // Базовая площадь в расширенном режиме = 0 (все через секции)
    floorArea = 0;
    perimeter = 0; // Сбрасываем периметр, чтобы не использовать данные из простого режима

    subSections.forEach(subSection => {
      const { area, perimeter: subPerimeter } = calculateSectionMetrics(subSection);

      floorArea += area;
      perimeter += subPerimeter;
    });

    // Пересчет площади стен
    grossWallArea = perimeter * room.height;

    // Проемы из всех секций
    let totalWindowsArea = 0;
    let totalDoorsArea = 0;
    let totalDoorsWidth = 0;

    subSections.forEach(subSection => {
      totalWindowsArea += (subSection.windows || []).reduce((sum, w) => sum + w.width * w.height, 0);
      totalDoorsArea += (subSection.doors || []).reduce((sum, d) => sum + d.width * d.height, 0);
      totalDoorsWidth += (subSection.doors || []).reduce((sum, d) => sum + d.width, 0);
    });

    // Гарантируем неотрицательные значения
    floorArea = Math.max(0, floorArea);
    perimeter = Math.max(0, perimeter);
    grossWallArea = Math.max(0, grossWallArea);

    const netWallArea = Math.max(0, grossWallArea - totalWindowsArea - totalDoorsArea);
    const skirtingLength = Math.max(0, perimeter - totalDoorsWidth);

    // Объем помещения
    const volume = floorArea * room.height;

    return {
      floorArea,
      perimeter,
      grossWallArea,
      windowsArea: totalWindowsArea,
      doorsArea: totalDoorsArea,
      netWallArea,
      skirtingLength,
      volume
    };
  }

  // Профессиональный режим: учет сегментов и препятствий
  if (room.geometryMode === 'advanced') {
    // Сбрасываем базовые значения, чтобы не использовать данные из простого режима
    floorArea = 0;
    perimeter = 0;

    // Сегменты: добавляем/вычитаем площадь и периметр
    segments.forEach(segment => {
      const segmentArea = segment.length * segment.width;
      const segmentPerimeter = (segment.length + segment.width) * 2;
      const sign = segment.operation === 'add' ? 1 : -1;

      floorArea += segmentArea * sign;
      perimeter += segmentPerimeter * sign;
    });

    // Препятствия: добавляем/вычитаем площадь и периметр
    obstacles.forEach(obstacle => {
      const sign = obstacle.operation === 'add' ? 1 : -1;
      floorArea += obstacle.area * sign;
      perimeter += obstacle.perimeter * sign;
    });

    // Пересчет площади стен с новым периметром
    grossWallArea = perimeter * room.height;

    // Перепады высоты: корректируем площадь стен
    wallSections.forEach(section => {
      // Вычитаем стандартную площадь этого участка
      grossWallArea -= section.length * room.height;
      // Добавляем площадь с фактической высотой
      grossWallArea += section.length * section.height;
    });
  }

  // Гарантируем неотрицательные значения
  floorArea = Math.max(0, floorArea);
  perimeter = Math.max(0, perimeter);
  grossWallArea = Math.max(0, grossWallArea);

  // Расчет проемов
  const windowsArea = windows.reduce((sum, w) => sum + w.width * w.height, 0);
  const doorsArea = doors.reduce((sum, d) => sum + d.width * d.height, 0);
  const doorsWidth = doors.reduce((sum, d) => sum + d.width, 0);

  const netWallArea = Math.max(0, grossWallArea - windowsArea - doorsArea);
  const skirtingLength = Math.max(0, perimeter - doorsWidth);

  // Объем помещения
  const volume = floorArea * room.height;

  return {
    floorArea,
    perimeter,
    grossWallArea,
    windowsArea,
    doorsArea,
    netWallArea,
    skirtingLength,
    volume
  };
}