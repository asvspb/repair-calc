import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, Menu, X, ChevronRight, ChevronUp, LayoutDashboard, Settings2, Save, AlertCircle, Layers, Box, Ruler, GripVertical, Wrench, Package, Square, Triangle } from 'lucide-react';

// Custom SVG icons for shapes not available in lucide-react
const Trapezoid = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19 L7 5 L17 5 L20 19 Z" />
  </svg>
);

const Parallelogram = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 19 L12 5 L22 5 L18 19 Z" />
  </svg>
);
import { useProjects } from './hooks/useProjects';
import { ChangeEvent } from 'react';
import { BackupManager } from './components/BackupManager';
import { StorageManager } from './utils/storage';

export type Opening = {
  id: string;
  width: number;
  height: number;
};

export type CalculationType = 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';

// New types for materials and tools
export type Material = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
};

export type Tool = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isRent: boolean;
  rentPeriod?: number;
};

export type WorkData = {
  id: string;
  name: string;
  unit: string;
  enabled: boolean;
  workUnitPrice: number;
  // Legacy fields (for backward compatibility)
  materialPriceType?: 'per_unit' | 'total';
  materialPrice?: number;
  // New fields
  materials?: Material[];
  tools?: Tool[];
  count?: number;
  calculationType: CalculationType;
  isCustom?: boolean;
  // Manual quantity override
  useManualQty?: boolean;
  manualQty?: number;
};

// Geometry modes: simple (rectangular), extended (subsections), advanced (professional)
export type GeometryMode = 'simple' | 'extended' | 'advanced';

// Section shapes for extended mode
export type SectionShape = 'rectangle' | 'trapezoid' | 'triangle' | 'parallelogram';

// Extended mode: sub-sections with own openings
export type RoomSubSection = {
  id: string;
  name: string;
  shape: SectionShape;
  // Rectangle: length × width
  length: number;
  width: number;
  // Trapezoid: base1, base2, height, side1, side2
  base1?: number;
  base2?: number;
  height?: number;
  side1?: number;
  side2?: number;
  // Triangle: sideA, sideB, sideC (or base + height for simple)
  sideA?: number;
  sideB?: number;
  sideC?: number;
  // Parallelogram: base, height, side
  base?: number;
  side?: number;
  // Openings
  windows: Opening[];
  doors: Opening[];
};

export type RoomSegment = {
  id: string;
  name: string;
  length: number;
  width: number;
  operation: 'add' | 'subtract';
};

export type ObstacleType = 'column' | 'duct' | 'niche' | 'other';

export type Obstacle = {
  id: string;
  name: string;
  type: ObstacleType;
  area: number;
  perimeter: number;
  operation: 'add' | 'subtract';
};

export type WallSection = {
  id: string;
  name: string;
  length: number;
  height: number;
};

export type RoomData = {
  id: string;
  name: string;
  geometryMode: GeometryMode;
  length: number;
  width: number;
  height: number;
  segments: RoomSegment[];
  obstacles: Obstacle[];
  wallSections: WallSection[];
  subSections: RoomSubSection[];  // Extended mode: rectangular sub-rooms
  windows: Opening[];
  doors: Opening[];
  works: WorkData[];
};

export type ProjectData = {
  id: string;
  name: string;
  rooms: RoomData[];
};

const initialRooms: RoomData[] = [
  {
    id: '1',
    name: 'Комната 1',
    geometryMode: 'simple',
    length: 3.6,
    width: 2.9,
    height: 2.6,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [{ id: 'w1', width: 1.5, height: 1.5 }],
    doors: [{ id: 'd1', width: 1.0, height: 2.2 }],
    works: [
      { id: 'floorLeveling', name: 'Выравнивание пола', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 400, materialPriceType: 'total', materialPrice: 2500, isCustom: true },
      { id: 'laminate', name: 'Укладка ламината', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'skirting', name: 'Монтаж плинтусов', unit: 'пог. м', calculationType: 'skirtingLength', enabled: true, workUnitPrice: 200, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'puttying', name: 'Шпаклевание стен', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 450, materialPriceType: 'total', materialPrice: 3500, isCustom: true },
      { id: 'wallpaper', name: 'Поклейка обоев', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 800, isCustom: true },
      { id: 'ceiling', name: 'Натяжной потолок', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 900, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'doorInstall', name: 'Установка дверей', unit: 'шт', calculationType: 'customCount', enabled: true, workUnitPrice: 4500, materialPriceType: 'total', materialPrice: 15000, count: 1, isCustom: true },
      { id: 'electrical', name: 'Электрика', unit: 'точек', calculationType: 'customCount', enabled: true, workUnitPrice: 300, materialPriceType: 'total', materialPrice: 4000, count: 6, isCustom: true },
    ]
  },
  {
    id: '2',
    name: 'Комната 2',
    geometryMode: 'simple',
    length: 4.9,
    width: 3.6,
    height: 2.6,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [{ id: 'w2', width: 1.4, height: 2.1 }],
    doors: [{ id: 'd2', width: 2.2, height: 2.5 }],
    works: [
      { id: 'floorLeveling', name: 'Выравнивание пола', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 400, materialPriceType: 'total', materialPrice: 4500, isCustom: true },
      { id: 'laminate', name: 'Укладка ламината', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'skirting', name: 'Монтаж плинтусов', unit: 'пог. м', calculationType: 'skirtingLength', enabled: true, workUnitPrice: 200, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'puttying', name: 'Шпаклевание стен', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 450, materialPriceType: 'total', materialPrice: 4500, isCustom: true },
      { id: 'wallpaper', name: 'Поклейка обоев', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 1200, isCustom: true },
      { id: 'ceiling', name: 'Натяжной потолок', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 900, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'doorInstall', name: 'Установка дверей', unit: 'шт', calculationType: 'customCount', enabled: true, workUnitPrice: 8000, materialPriceType: 'total', materialPrice: 35000, count: 1, isCustom: true },
      { id: 'electrical', name: 'Электрика', unit: 'точек', calculationType: 'customCount', enabled: true, workUnitPrice: 300, materialPriceType: 'total', materialPrice: 6500, count: 10, isCustom: true },
    ]
  }
];

const initialProjects: ProjectData[] = [
  {
    id: 'p1',
    name: 'Квартира (пример)',
    rooms: initialRooms
  }
];

const createNewProject = (): ProjectData => ({
  id: Math.random().toString(36).substring(2, 11),
  name: 'Новый объект',
  rooms: []
});

const createNewRoom = (): RoomData => ({
  id: Math.random().toString(36).substring(2, 11),
  name: 'Новая комната',
  geometryMode: 'simple',
  length: 0,
  width: 0,
  height: 0,
  segments: [],
  obstacles: [],
  wallSections: [],
  subSections: [],
  windows: [],
  doors: [],
  works: []
});

// Миграция данных для обратной совместимости
function migrateWorkData(work: WorkData): WorkData {
  // Создаём копию, чтобы не мутировать оригинальный объект
  const migrated = { ...work };
  
  // Если materials/tools не существуют - инициализируем пустыми массивами
  if (!migrated.materials) {
    migrated.materials = [];
  }
  if (!migrated.tools) {
    migrated.tools = [];
  }
  
  // Если есть legacy materialPrice и нет материалов - создаём один материал
  if (migrated.materialPrice && migrated.materialPrice > 0 && migrated.materials.length === 0) {
    migrated.materials = [{
      id: Math.random().toString(36).substring(2, 11),
      name: 'Материалы',
      quantity: 1,
      unit: migrated.unit || 'м²',
      pricePerUnit: migrated.materialPrice
    }];
  }
  
  return migrated;
}

// Создание нового материала
const createNewMaterial = (unit: string): Material => ({
  id: Math.random().toString(36).substring(2, 11),
  name: '',
  quantity: 1,
  unit: unit,
  pricePerUnit: 0
});

// Создание нового инструмента
const createNewTool = (): Tool => ({
  id: Math.random().toString(36).substring(2, 11),
  name: '',
  quantity: 1,
  price: 0,
  isRent: false,
  rentPeriod: 1
});

function calculateRoomMetrics(room: RoomData) {
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

  // Helper function to calculate section metrics based on shape
  function calculateSectionMetrics(section: RoomSubSection): { area: number; perimeter: number } {
    const shape = section.shape || 'rectangle'; // Default to rectangle for backward compatibility
    
    switch (shape) {
      case 'rectangle': {
        const area = section.length * section.width;
        const perimeter = (section.length + section.width) * 2;
        return { area, perimeter };
      }
      
      case 'trapezoid': {
        // Площадь трапеции: (base1 + base2) * height / 2
        // Периметр: base1 + base2 + side1 + side2
        const base1 = section.base1 || 0;
        const base2 = section.base2 || 0;
        const height = section.height || 0;
        const side1 = section.side1 || 0;
        const side2 = section.side2 || 0;
        const area = (base1 + base2) * height / 2;
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
        // Площадь: base × height
        // Периметр: 2 × (base + side)
        const base = section.base || section.length || 0;
        const height = section.height || section.width || 0;
        const side = section.side || 0;
        const area = base * height;
        const perimeter = 2 * (base + side);
        return { area, perimeter };
      }
      
      default:
        return { area: 0, perimeter: 0 };
    }
  }

  // Расширенный режим: секции (подпомещения)
  if (room.geometryMode === 'extended') {
    // Каждая секция может иметь разную форму
    // Площадь пола = сумма площадей всех секций + базовая площадь
    // Базовая площадь в расширенном режиме = 0 (все через секции)
    floorArea = 0;
    
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

function calculateRoomCosts(room: RoomData) {
  const metrics = calculateRoomMetrics(room);
  
  const costs: Record<string, { work: number, material: number, tools: number, total: number }> = {};

  let totalWork = 0;
  let totalMaterial = 0;
  let totalTools = 0;

  const works = room.works || [];
  works.forEach(work => {
    // Применяем миграцию для обратной совместимости
    const migratedWork = migrateWorkData(work);
    
    if (!migratedWork.enabled) {
      costs[migratedWork.id] = { work: 0, material: 0, tools: 0, total: 0 };
      return;
    }
    
    let qty = 0;
    if (migratedWork.manualQty !== undefined) {
      // Используем заданный объем
      qty = migratedWork.manualQty;
    } else if (migratedWork.calculationType === 'floorArea') qty = metrics.floorArea;
    else if (migratedWork.calculationType === 'netWallArea') qty = metrics.netWallArea;
    else if (migratedWork.calculationType === 'skirtingLength') qty = metrics.skirtingLength;
    else if (migratedWork.calculationType === 'customCount') qty = migratedWork.count || 0;

    // Стоимость работы
    const wCost = qty * migratedWork.workUnitPrice;
    
    // Стоимость материалов (новый способ или legacy)
    let mCost = 0;
    if (migratedWork.materials && migratedWork.materials.length > 0) {
      // Новый способ: сумма стоимости всех материалов
      mCost = migratedWork.materials.reduce((sum, m) => sum + m.quantity * m.pricePerUnit, 0);
    } else if (migratedWork.materialPrice) {
      // Legacy: старый способ расчёта
      mCost = migratedWork.materialPriceType === 'per_unit' ? qty * migratedWork.materialPrice : migratedWork.materialPrice;
    }
    
    // Стоимость инструментов
    const tCost = (migratedWork.tools || []).reduce((sum, t) => {
      if (t.isRent && t.rentPeriod) {
        return sum + t.price * t.quantity * t.rentPeriod;
      }
      return sum + t.price * t.quantity;
    }, 0);
    
    costs[migratedWork.id] = { work: wCost, material: mCost, tools: tCost, total: wCost + mCost + tCost };
    totalWork += wCost;
    totalMaterial += mCost;
    totalTools += tCost;
  });

  return { costs, totalWork, totalMaterial, totalTools, total: totalWork + totalMaterial + totalTools };
}

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  step?: number;
};

function NumberInput({ value, onChange, className = '', min = 0, step = 1 }: NumberInputProps) {
  const [str, setStr] = useState(value.toString());
  const isTypingRef = React.useRef(false);

  useEffect(() => {
    // Синхронизируем с внешним value только если пользователь не вводит данные
    if (!isTypingRef.current) {
      setStr(value.toString());
    }
  }, [value]);

  const handleFocus = () => {
    isTypingRef.current = true;
  };

  const handleBlur = () => {
    isTypingRef.current = false;
    // При потере фокуса синхронизируем с value
    setStr(value.toString());
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStr(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (val === '') {
      onChange(0);
    }
  };

  return (
    <input 
      type="number" 
      min={min} 
      step={step} 
      value={str} 
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${className}`} 
    />
  );
}

function SummaryView({ project, updateProject, deleteProject }: { project: ProjectData, updateProject: (p: ProjectData) => void, deleteProject: () => void }) {
  let totalFloorArea = 0;
  let totalWallArea = 0;
  let totalVolume = 0;
  let totalWorkCost = 0;
  let totalMaterialCost = 0;
  let totalToolsCost = 0;

  project.rooms.forEach(r => {
    const metrics = calculateRoomMetrics(r);
    const costs = calculateRoomCosts(r);
    totalFloorArea += metrics.floorArea;
    totalWallArea += metrics.netWallArea;
    totalVolume += metrics.volume || 0;
    totalWorkCost += costs.totalWork;
    totalMaterialCost += costs.totalMaterial;
    totalToolsCost += costs.totalTools;
  });

  const grandTotal = totalWorkCost + totalMaterialCost + totalToolsCost;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <input
          className="text-3xl font-light text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full max-w-md"
          value={project.name}
          onChange={e => updateProject({...project, name: e.target.value})}
          placeholder="Название объекта"
        />
        <button onClick={deleteProject} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" title="Удалить объект">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Площадь по полу</div>
          <div className="text-3xl font-light">{totalFloorArea.toFixed(2)} <span className="text-lg text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Площадь стен</div>
          <div className="text-3xl font-light">{totalWallArea.toFixed(2)} <span className="text-lg text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Общий объем</div>
          <div className="text-3xl font-light">{totalVolume.toFixed(2)} <span className="text-lg text-gray-400">м³</span></div>
        </div>
        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-md">
          <div className="text-indigo-100 text-sm mb-1">Итоговая стоимость</div>
          <div className="text-3xl font-semibold">{grandTotal.toLocaleString('ru-RU')} <span className="text-indigo-200 text-lg">₽</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-medium">Детализация по комнатам</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {project.rooms.map(room => {
            const costs = calculateRoomCosts(room);
            return (
              <div key={room.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="font-medium text-lg">{room.name}</h4>
                  <div className="text-sm text-gray-500 mt-1">
                    Работы: {costs.totalWork.toLocaleString('ru-RU')} ₽ • Материалы: {costs.totalMaterial.toLocaleString('ru-RU')} ₽{costs.totalTools > 0 && (
                      <span> • Инструменты: {costs.totalTools.toLocaleString('ru-RU')} ₽</span>
                    )}
                  </div>
                </div>
                <div className="text-2xl font-light">
                  {costs.total.toLocaleString('ru-RU')} ₽
                </div>
              </div>
            );
          })}
          {project.rooms.length === 0 && (
            <div className="p-6 text-center text-gray-500 italic">
              Нет добавленных комнат
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomEditor({ room, updateRoom, deleteRoom }: { room: RoomData, updateRoom: (r: RoomData) => void, deleteRoom: () => void }) {
  const metrics = calculateRoomMetrics(room);
  const { costs, total } = calculateRoomCosts(room);
  
  // Состояние для развернутых карточек работ
  const [expandedWorks, setExpandedWorks] = useState<Set<string>>(new Set());
  
  const toggleWorkExpand = (workId: string) => {
    setExpandedWorks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workId)) {
        newSet.delete(workId);
      } else {
        newSet.add(workId);
      }
      return newSet;
    });
  };

  const handleWorkChange = (id: string, field: keyof WorkData, value: string | number | boolean) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => w.id === id ? { ...w, [field]: value } : w)
    });
  };
  
  // Обработчики материалов
  const handleMaterialChange = (workId: string, materialId: string, field: keyof Material, value: string | number) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: (w.materials || []).map(m => m.id === materialId ? { ...m, [field]: value } : m)
        };
      })
    });
  };
  
  const addMaterial = (workId: string) => {
    const work = (room.works || []).find(w => w.id === workId);
    const newMaterial = createNewMaterial(work?.unit || 'м²');
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: [...(w.materials || []), newMaterial]
        };
      })
    });
  };
  
  const removeMaterial = (workId: string, materialId: string) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: (w.materials || []).filter(m => m.id !== materialId)
        };
      })
    });
  };
  
  // Обработчики инструментов
  const handleToolChange = (workId: string, toolId: string, field: keyof Tool, value: string | number | boolean) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: (w.tools || []).map(t => t.id === toolId ? { ...t, [field]: value } : t)
        };
      })
    });
  };
  
  const addTool = (workId: string) => {
    const newTool = createNewTool();
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: [...(w.tools || []), newTool]
        };
      })
    });
  };
  
  const removeTool = (workId: string, toolId: string) => {
    updateRoom({
      ...room,
      works: (room.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: (w.tools || []).filter(t => t.id !== toolId)
        };
      })
    });
  };

  const addCustomWork = () => {
    const newWork: WorkData = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Новая работа',
      unit: 'м²',
      enabled: true,
      workUnitPrice: 0,
      materialPriceType: 'total',
      materialPrice: 0,
      materials: [],
      tools: [],
      calculationType: 'floorArea',
      isCustom: true
    };
    updateRoom({
      ...room,
      works: [...(room.works || []), newWork]
    });
  };

  const removeWork = (id: string) => {
    updateRoom({
      ...room,
      works: (room.works || []).filter(w => w.id !== id)
    });
  };

  const addWindow = () => updateRoom({...room, windows: [...room.windows, { id: Math.random().toString(), width: 1.5, height: 1.5 }]});
  const removeWindow = (id: string) => updateRoom({...room, windows: room.windows.filter(w => w.id !== id)});
  const updateWindow = (id: string, field: keyof Opening, val: number) => updateRoom({...room, windows: room.windows.map(w => w.id === id ? { ...w, [field]: val } : w)});

  const addDoor = () => updateRoom({...room, doors: [...room.doors, { id: Math.random().toString(), width: 0.9, height: 2.0 }]});
  const removeDoor = (id: string) => updateRoom({...room, doors: room.doors.filter(d => d.id !== id)});
  const updateDoor = (id: string, field: keyof Opening, val: number) => updateRoom({...room, doors: room.doors.map(d => d.id === id ? { ...d, [field]: val } : d)});

  // Advanced geometry: Segments
  const addSegment = () => {
    const newSegment: RoomSegment = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Ниша',
      length: 1,
      width: 0.5,
      operation: 'subtract'
    };
    updateRoom({...room, segments: [...room.segments, newSegment]});
  };
  const removeSegment = (id: string) => updateRoom({...room, segments: room.segments.filter(s => s.id !== id)});
  const updateSegment = (id: string, field: keyof RoomSegment, val: string | number) => {
    updateRoom({...room, segments: room.segments.map(s => s.id === id ? { ...s, [field]: val } : s)});
  };

  // Advanced geometry: Obstacles
  const addObstacle = () => {
    const newObstacle: Obstacle = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Колонна',
      type: 'column',
      area: 0.25,
      perimeter: 2,
      operation: 'subtract'
    };
    updateRoom({...room, obstacles: [...room.obstacles, newObstacle]});
  };
  const removeObstacle = (id: string) => updateRoom({...room, obstacles: room.obstacles.filter(o => o.id !== id)});
  const updateObstacle = (id: string, field: keyof Obstacle, val: string | number) => {
    updateRoom({...room, obstacles: room.obstacles.map(o => o.id === id ? { ...o, [field]: val } : o)});
  };

  // Advanced geometry: Wall sections
  const addWallSection = () => {
    const newSection: WallSection = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Участок с перепадом',
      length: 1,
      height: 3
    };
    updateRoom({...room, wallSections: [...room.wallSections, newSection]});
  };
  const removeWallSection = (id: string) => updateRoom({...room, wallSections: room.wallSections.filter(ws => ws.id !== id)});
  const updateWallSection = (id: string, field: keyof WallSection, val: string | number) => {
    updateRoom({...room, wallSections: room.wallSections.map(ws => ws.id === id ? { ...ws, [field]: val } : ws)});
  };

  // Calculate advanced metrics
  const segmentsDelta = room.segments.reduce((sum, s) => sum + (s.length * s.width * (s.operation === 'add' ? 1 : -1)), 0);
  const obstaclesDelta = room.obstacles.reduce((sum, o) => sum + (o.area * (o.operation === 'add' ? 1 : -1)), 0);

  // Handler for geometry mode switching - clears mode-specific data
  const handleGeometryModeChange = (newMode: GeometryMode) => {
    let updatedRoom: RoomData = {
      ...room,
      geometryMode: newMode
    };

    // When switching FROM Simple mode TO Extended or Advanced
    if (room.geometryMode === 'simple' && newMode !== 'simple') {
      // Clear simple mode specific data when switching to extended or advanced
      if (newMode === 'extended') {
        updatedRoom = {
          ...updatedRoom,
          length: 0,
          width: 0,
          windows: [],
          doors: []
        };
      } else if (newMode === 'advanced') {
        updatedRoom = {
          ...updatedRoom,
          length: 0,
          width: 0,
          windows: [],
          doors: []
        };
      }
    }

    // When switching FROM Extended mode TO Simple or Advanced
    if (room.geometryMode === 'extended' && newMode !== 'extended') {
      updatedRoom = {
        ...updatedRoom,
        subSections: []
      };
    }

    // When switching FROM Advanced mode TO Simple or Extended
    if (room.geometryMode === 'advanced' && newMode !== 'advanced') {
      updatedRoom = {
        ...updatedRoom,
        segments: [],
        obstacles: [],
        wallSections: []
      };
    }

    updateRoom(updatedRoom);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div className="group flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <input
          className="text-2xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full max-w-md"
          value={room.name}
          onChange={e => updateRoom({...room, name: e.target.value})}
        />
        <button onClick={deleteRoom} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Удалить комнату">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Площадь пола</div>
          <div className="text-xl font-light">{metrics.floorArea.toFixed(2)} <span className="text-sm text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Площадь стен</div>
          <div className="text-xl font-light">{metrics.netWallArea.toFixed(2)} <span className="text-sm text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Периметр/Плинтус</div>
          <div className="flex items-baseline gap-2">
            <div className="flex flex-col items-center">
              <div className="text-xl font-light">{metrics.perimeter.toFixed(2)}</div>
              <div className="w-10 border-t border-gray-200 my-1"></div>
              <div className="text-xl font-light">{metrics.skirtingLength.toFixed(2)}</div>
            </div>
            <span className="text-sm text-gray-400">м</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Объем</div>
          <div className="text-xl font-light">{metrics.volume?.toFixed(2) || '0.00'} <span className="text-sm text-gray-400">м³</span></div>
        </div>
        <div className="bg-indigo-50 p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-indigo-600 mb-1">Итого по комнате</div>
          <div className="text-xl font-semibold text-indigo-900">{total.toLocaleString('ru-RU')} <span className="text-sm text-indigo-400">₽</span></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-medium">Габариты помещения</h3>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleGeometryModeChange('simple')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                room.geometryMode === 'simple'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Простой
            </button>
            <button
              onClick={() => handleGeometryModeChange('extended')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                room.geometryMode === 'extended'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Расширенный
            </button>
            <button
              onClick={() => handleGeometryModeChange('advanced')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                room.geometryMode === 'advanced'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Профессиональный
            </button>
          </div>
        </div>
        
        {/* Mode descriptions */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          {room.geometryMode === 'simple' && (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Простой режим:</span> одна прямоугольная комната с окнами и дверями.
            </p>
          )}
          {room.geometryMode === 'extended' && (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Расширенный режим:</span> несколько прямоугольных секций (например, L-образная комната). Каждая секция имеет свои проёмы.
            </p>
          )}
          {room.geometryMode === 'advanced' && (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Профессиональный режим:</span> сегменты, препятствия, перепады высоты стен — для помещений сложной формы.
            </p>
          )}
        </div>
        
        {/* Warning about existing data */}
        {room.geometryMode === 'simple' && (room.segments.length + room.obstacles.length + room.wallSections.length + room.subSections.length > 0) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Есть данные в других режимах. Переключение в простой режим сохранит их, но они не будут учитываться в расчетах.
            </p>
          </div>
        )}
        
        {room.geometryMode === 'extended' && (room.segments.length + room.obstacles.length + room.wallSections.length > 0) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Есть данные в профессиональном режиме. При переключении они сохранятся, но не будут использоваться.
            </p>
          </div>
        )}
        
        {/* Height is always visible */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {room.geometryMode !== 'extended' && (
            <>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Длина (м)</label>
                <NumberInput value={room.length} onChange={(v: number) => updateRoom({...room, length: v})} className="w-full" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Ширина (м)</label>
                <NumberInput value={room.width} onChange={(v: number) => updateRoom({...room, width: v})} className="w-full" />
              </div>
            </>
          )}
          {room.geometryMode === 'extended' && (
            <>
              <div className="sm:col-span-2 text-sm text-gray-500 italic flex items-end pb-2">
                Размеры секций указаны ниже
              </div>
            </>
          )}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Высота (м)</label>
            <NumberInput value={room.height} onChange={(v: number) => updateRoom({...room, height: v})} className="w-full" />
          </div>
        </div>
      </div>

      {/* Extended mode: SubSections */}
      {room.geometryMode === 'extended' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-medium">Секции помещения</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Разбейте помещение на секции разной формы. Каждая секция может иметь свои окна и двери.</p>
          
          {/* Shape type legend */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-600 mb-2">Доступные формы секций:</div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Square className="w-4 h-4 text-indigo-500" /> Прямоугольник</span>
              <span className="flex items-center gap-1"><Trapezoid className="w-4 h-4 text-indigo-500" /> Трапеция</span>
              <span className="flex items-center gap-1"><Triangle className="w-4 h-4 text-indigo-500" /> Треугольник</span>
              <span className="flex items-center gap-1"><Parallelogram className="w-4 h-4 text-indigo-500" /> Параллелограмм</span>
            </div>
          </div>
          
          {room.subSections.length === 0 ? (
            <div className="text-sm text-gray-400 italic mb-4">Нет секций. Добавьте хотя бы одну секцию.</div>
          ) : (
            <div className="space-y-4 mb-4">
              {room.subSections.map((subSection, i) => {
                // Calculate metrics based on shape
                const getSectionMetrics = () => {
                  const shape = subSection.shape || 'rectangle';
                  switch (shape) {
                    case 'rectangle':
                      return { area: subSection.length * subSection.width, perimeter: (subSection.length + subSection.width) * 2 };
                    case 'trapezoid': {
                      const base1 = subSection.base1 || 0;
                      const base2 = subSection.base2 || 0;
                      const height = subSection.height || 0;
                      const side1 = subSection.side1 || 0;
                      const side2 = subSection.side2 || 0;
                      return { area: (base1 + base2) * height / 2, perimeter: base1 + base2 + side1 + side2 };
                    }
                    case 'triangle': {
                      const a = subSection.sideA || 0;
                      const b = subSection.sideB || 0;
                      const c = subSection.sideC || 0;
                      if (a > 0 && b > 0 && c > 0 && a + b > c && a + c > b && b + c > a) {
                        const s = (a + b + c) / 2;
                        return { area: Math.sqrt(s * (s - a) * (s - b) * (s - c)), perimeter: a + b + c };
                      }
                      return { area: (subSection.length * subSection.width) / 2, perimeter: subSection.length + subSection.width + Math.sqrt(subSection.length ** 2 + subSection.width ** 2) };
                    }
                    case 'parallelogram': {
                      const base = subSection.base || subSection.length || 0;
                      const height = subSection.height || subSection.width || 0;
                      const side = subSection.side || 0;
                      return { area: base * height, perimeter: 2 * (base + side) };
                    }
                    default:
                      return { area: 0, perimeter: 0 };
                  }
                };
                const subMetrics = getSectionMetrics();
                const openingsArea = (subSection.windows || []).reduce((sum, w) => sum + w.width * w.height, 0) +
                                    (subSection.doors || []).reduce((sum, d) => sum + d.width * d.height, 0);
                const wallArea = subMetrics.perimeter * room.height - openingsArea;
                const volume = subMetrics.area * room.height;
                const doorsWidth = (subSection.doors || []).reduce((sum, d) => sum + d.width, 0);
                const skirtingLength = Math.max(0, subMetrics.perimeter - doorsWidth);
                
                // Shape icon
                const ShapeIcon = subSection.shape === 'trapezoid' ? Trapezoid : 
                                  subSection.shape === 'triangle' ? Triangle : 
                                  subSection.shape === 'parallelogram' ? Parallelogram : Square;
                
                return (
                  <div key={subSection.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">{i + 1}</span>
                      <ShapeIcon className="w-4 h-4 text-indigo-500" />
                      <input
                        value={subSection.name}
                        onChange={e => {
                          const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, name: e.target.value } : s);
                          updateRoom({...room, subSections: updated});
                        }}
                        className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                        placeholder="Название секции"
                      />
                      <button 
                        onClick={() => updateRoom({...room, subSections: room.subSections.filter(s => s.id !== subSection.id)})} 
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Shape selector */}
                    <div className="mb-4 pl-10">
                      <label className="block text-xs text-gray-500 mb-2">Форма секции</label>
                      <div className="flex flex-wrap gap-2">
                        {(['rectangle', 'trapezoid', 'triangle', 'parallelogram'] as SectionShape[]).map(shape => {
                          const Icon = shape === 'trapezoid' ? Trapezoid : 
                                      shape === 'triangle' ? Triangle : 
                                      shape === 'parallelogram' ? Parallelogram : Square;
                          const label = shape === 'rectangle' ? 'Прямоугольник' :
                                        shape === 'trapezoid' ? 'Трапеция' :
                                        shape === 'triangle' ? 'Треугольник' : 'Параллелограмм';
                          return (
                            <button
                              key={shape}
                              onClick={() => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, shape } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                (subSection.shape || 'rectangle') === shape
                                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Dimension inputs based on shape */}
                    <div className="mb-4 pl-10">
                      {subSection.shape === 'rectangle' || !subSection.shape ? (
                        // Rectangle: length × width
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
                            <NumberInput 
                              value={subSection.length} 
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, length: v } : s);
                                updateRoom({...room, subSections: updated});
                              }} 
                              className="w-full" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Ширина (м)</label>
                            <NumberInput 
                              value={subSection.width} 
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, width: v } : s);
                                updateRoom({...room, subSections: updated});
                              }} 
                              className="w-full" 
                            />
                          </div>
                        </div>
                      ) : subSection.shape === 'trapezoid' ? (
                        // Trapezoid: base1, base2, height, side1, side2
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Основание 1 (м)</label>
                            <NumberInput
                              value={subSection.base1 || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, base1: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Основание 2 (м)</label>
                            <NumberInput
                              value={subSection.base2 || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, base2: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Высота (м)</label>
                            <NumberInput
                              value={subSection.height || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, height: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Бок. сторона 1 (м)</label>
                            <NumberInput
                              value={subSection.side1 || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, side1: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Бок. сторона 2 (м)</label>
                            <NumberInput
                              value={subSection.side2 || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, side2: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                        </div>
                      ) : subSection.shape === 'triangle' ? (
                        // Triangle: sideA, sideB, sideC
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Сторона A (м)</label>
                            <NumberInput
                              value={subSection.sideA || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, sideA: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Сторона B (м)</label>
                            <NumberInput
                              value={subSection.sideB || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, sideB: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Сторона C (м)</label>
                            <NumberInput
                              value={subSection.sideC || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, sideC: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                        </div>
                      ) : subSection.shape === 'parallelogram' ? (
                        // Parallelogram: base, height, side
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Основание (м)</label>
                            <NumberInput
                              value={subSection.base || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, base: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Высота (м)</label>
                            <NumberInput
                              value={subSection.height || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, height: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Боковая сторона (м)</label>
                            <NumberInput
                              value={subSection.side || 0}
                              onChange={(v: number) => {
                                const updated = room.subSections.map(s => s.id === subSection.id ? { ...s, side: v } : s);
                                updateRoom({...room, subSections: updated});
                              }}
                              className="w-full"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    
                    {/* Windows and Doors for this subsection */}
                    <div className="pl-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3 bg-white rounded-lg border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-600">Окна</span>
                          <button 
                            onClick={() => {
                              const newWindow = { id: Math.random().toString(), width: 1.5, height: 1.5 };
                              const updated = room.subSections.map(s => s.id === subSection.id 
                                ? { ...s, windows: [...(s.windows || []), newWindow] } 
                                : s
                              );
                              updateRoom({...room, subSections: updated});
                            }}
                            className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                          >
                            + Добавить
                          </button>
                        </div>
                        {(subSection.windows || []).length === 0 ? (
                          <div className="text-xs text-gray-400 italic">Нет окон</div>
                        ) : (
                          <div className="space-y-2">
                            {subSection.windows.map((w, wi) => (
                              <div key={w.id} className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-4">{wi + 1}.</span>
                                <NumberInput 
                                  value={w.width} 
                                  onChange={(v: number) => {
                                    const updated = room.subSections.map(s => s.id === subSection.id 
                                      ? { ...s, windows: s.windows.map(win => win.id === w.id ? { ...win, width: v } : win) } 
                                      : s
                                    );
                                    updateRoom({...room, subSections: updated});
                                  }}
                                  className="w-16 text-xs py-1" 
                                />
                                <span className="text-gray-400 text-xs">×</span>
                                <NumberInput 
                                  value={w.height} 
                                  onChange={(v: number) => {
                                    const updated = room.subSections.map(s => s.id === subSection.id 
                                      ? { ...s, windows: s.windows.map(win => win.id === w.id ? { ...win, height: v } : win) } 
                                      : s
                                    );
                                    updateRoom({...room, subSections: updated});
                                  }}
                                  className="w-16 text-xs py-1" 
                                />
                                <button 
                                  onClick={() => {
                                    const updated = room.subSections.map(s => s.id === subSection.id 
                                      ? { ...s, windows: s.windows.filter(win => win.id !== w.id) } 
                                      : s
                                    );
                                    updateRoom({...room, subSections: updated});
                                  }}
                                  className="p-0.5 text-gray-300 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 bg-white rounded-lg border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-600">Двери/Проход</span>
                          <button 
                            onClick={() => {
                              const newDoor = { id: Math.random().toString(), width: 0.9, height: 2.0 };
                              const updated = room.subSections.map(s => s.id === subSection.id 
                                ? { ...s, doors: [...(s.doors || []), newDoor] } 
                                : s
                              );
                              updateRoom({...room, subSections: updated});
                            }}
                            className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                          >
                            + Добавить
                          </button>
                        </div>
                        {(subSection.doors || []).length === 0 ? (
                          <div className="text-xs text-gray-400 italic">Нет дверей</div>
                        ) : (
                          <div className="space-y-2">
                            {subSection.doors.map((d, di) => (
                              <div key={d.id} className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-4">{di + 1}.</span>
                                <NumberInput 
                                  value={d.width} 
                                  onChange={(v: number) => {
                                    const updated = room.subSections.map(s => s.id === subSection.id 
                                      ? { ...s, doors: s.doors.map(door => door.id === d.id ? { ...door, width: v } : door) } 
                                      : s
                                    );
                                    updateRoom({...room, subSections: updated});
                                  }}
                                  className="w-16 text-xs py-1" 
                                />
                                <span className="text-gray-400 text-xs">×</span>
                                <NumberInput 
                                  value={d.height} 
                                  onChange={(v: number) => {
                                    const updated = room.subSections.map(s => s.id === subSection.id 
                                      ? { ...s, doors: s.doors.map(door => door.id === d.id ? { ...door, height: v } : door) } 
                                      : s
                                    );
                                    updateRoom({...room, subSections: updated});
                                  }}
                                  className="w-16 text-xs py-1" 
                                />
                                <button 
                                  onClick={() => {
                                    const updated = room.subSections.map(s => s.id === subSection.id 
                                      ? { ...s, doors: s.doors.filter(door => door.id !== d.id) } 
                                      : s
                                    );
                                    updateRoom({...room, subSections: updated});
                                  }}
                                  className="p-0.5 text-gray-300 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section metrics */}
                    <div className="mt-4 pl-10">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-stretch">
                        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
                          <div className="text-xs text-gray-500 mb-1">Пол/Потолок</div>
                          <div className="text-sm font-semibold text-gray-900">{subMetrics.area.toFixed(2)} м²</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
                          <div className="text-xs text-gray-500 mb-1">Стены</div>
                          <div className="text-sm font-semibold text-gray-900">{wallArea.toFixed(2)} м²</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
                          <div className="text-xs text-gray-500 mb-1">Периметр/Плинтус</div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex flex-col items-center">
                              <div className="text-sm font-semibold">{subMetrics.perimeter.toFixed(2)}</div>
                              <div className="w-8 border-t border-gray-200 my-0.5"></div>
                              <div className="text-sm font-semibold">{skirtingLength.toFixed(2)}</div>
                            </div>
                            <span className="text-xs text-gray-400">м</span>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-center items-center text-center">
                          <div className="text-xs text-gray-500 mb-1">Объем</div>
                          <div className="text-sm font-semibold text-gray-900">{volume.toFixed(2)} м³</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => {
              const newSubSection: RoomSubSection = {
                id: Math.random().toString(36).substring(2, 11),
                name: `Секция ${room.subSections.length + 1}`,
                shape: 'rectangle',
                length: 0,
                width: 0,
                windows: [],
                doors: []
              };
              updateRoom({...room, subSections: [...room.subSections, newSubSection]});
            }} 
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            Добавить секцию
          </button>
        </div>
      )}

      {/* Advanced Geometry: Segments */}
      {room.geometryMode === 'advanced' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-medium">Сегменты помещения</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Для L-образных комнат, ниш и эркеров</p>
          
          {room.segments.length === 0 ? (
            <div className="text-sm text-gray-400 italic mb-4">Нет сегментов</div>
          ) : (
            <div className="space-y-3 mb-4">
              {room.segments.map((segment, i) => (
                <div key={segment.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                    <input
                      value={segment.name}
                      onChange={e => updateSegment(segment.id, 'name', e.target.value)}
                      className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                      placeholder="Название"
                    />
                    <button onClick={() => removeSegment(segment.id)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-8">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
                      <NumberInput value={segment.length} onChange={(v: number) => updateSegment(segment.id, 'length', v)} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ширина (м)</label>
                      <NumberInput value={segment.width} onChange={(v: number) => updateSegment(segment.id, 'width', v)} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Операция</label>
                      <select
                        value={segment.operation}
                        onChange={e => updateSegment(segment.id, 'operation', e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="add">Добавить</option>
                        <option value="subtract">Вычесть</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        Площадь: {(segment.length * segment.width).toFixed(2)} м²
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {room.segments.length > 0 && (
            <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
              <div className="text-sm text-indigo-700">
                <span className="font-medium">Итого сегменты:</span> {segmentsDelta > 0 ? '+' : ''}{segmentsDelta.toFixed(2)} м²
              </div>
            </div>
          )}
          
          <button onClick={addSegment} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all">
            <Plus className="w-4 h-4" />
            Добавить сегмент
          </button>
        </div>
      )}

      {/* Advanced Geometry: Obstacles */}
      {room.geometryMode === 'advanced' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Box className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-medium">Препятствия</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Колонны, воздуховоды, ниши</p>
          
          {room.obstacles.length === 0 ? (
            <div className="text-sm text-gray-400 italic mb-4">Нет препятствий</div>
          ) : (
            <div className="space-y-3 mb-4">
              {room.obstacles.map((obstacle, i) => (
                <div key={obstacle.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                    <input
                      value={obstacle.name}
                      onChange={e => updateObstacle(obstacle.id, 'name', e.target.value)}
                      className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                      placeholder="Название"
                    />
                    <button onClick={() => removeObstacle(obstacle.id)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pl-8">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Тип</label>
                      <select
                        value={obstacle.type}
                        onChange={e => updateObstacle(obstacle.id, 'type', e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="column">Колонна</option>
                        <option value="duct">Воздуховод</option>
                        <option value="niche">Ниша</option>
                        <option value="other">Другое</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Площадь (м²)</label>
                      <NumberInput value={obstacle.area} onChange={(v: number) => updateObstacle(obstacle.id, 'area', v)} className="w-full" step={0.01} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Периметр (м)</label>
                      <NumberInput value={obstacle.perimeter} onChange={(v: number) => updateObstacle(obstacle.id, 'perimeter', v)} className="w-full" step={0.1} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Операция</label>
                      <select
                        value={obstacle.operation}
                        onChange={e => updateObstacle(obstacle.id, 'operation', e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="add">Добавить</option>
                        <option value="subtract">Вычесть</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        {obstacle.operation === 'add' ? '+' : '-'} {obstacle.area.toFixed(2)} м²
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {room.obstacles.length > 0 && (
            <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
              <div className="text-sm text-indigo-700">
                <span className="font-medium">Итого препятствия:</span> {obstaclesDelta > 0 ? '+' : ''}{obstaclesDelta.toFixed(2)} м²
              </div>
            </div>
          )}
          
          <button onClick={addObstacle} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all">
            <Plus className="w-4 h-4" />
            Добавить препятствие
          </button>
        </div>
      )}

      {/* Advanced Geometry: Wall Sections */}
      {room.geometryMode === 'advanced' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-medium">Перепады высоты стен</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Участки стен с отличающейся высотой</p>
          
          {room.wallSections.length === 0 ? (
            <div className="text-sm text-gray-400 italic mb-4">Нет перепадов высоты</div>
          ) : (
            <div className="space-y-3 mb-4">
              {room.wallSections.map((section, i) => (
                <div key={section.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                    <input
                      value={section.name}
                      onChange={e => updateWallSection(section.id, 'name', e.target.value)}
                      className="flex-1 font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                      placeholder="Название"
                    />
                    <button onClick={() => removeWallSection(section.id)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pl-8">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Длина (м)</label>
                      <NumberInput value={section.length} onChange={(v: number) => updateWallSection(section.id, 'length', v)} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Высота (м)</label>
                      <NumberInput value={section.height} onChange={(v: number) => updateWallSection(section.id, 'height', v)} className="w-full" />
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        Площадь: {(section.length * section.height).toFixed(2)} м²
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button onClick={addWallSection} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-all">
            <Plus className="w-4 h-4" />
            Добавить участок
          </button>
        </div>
      )}

      {/* Windows and Doors - only for simple and advanced modes */}
      {room.geometryMode !== 'extended' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Окна</h3>
              <button onClick={addWindow} className="text-indigo-600 text-sm font-medium hover:text-indigo-700">+ Добавить</button>
            </div>
            {room.windows.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Нет окон</div>
            ) : (
              <div className="space-y-3">
                {room.windows.map((w, i) => (
                  <div key={w.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                    <NumberInput value={w.width} onChange={(v: number) => updateWindow(w.id, 'width', v)} className="w-20" />
                    <span className="text-gray-400">×</span>
                    <NumberInput value={w.height} onChange={(v: number) => updateWindow(w.id, 'height', v)} className="w-20" />
                    <button onClick={() => removeWindow(w.id)} className="p-1 text-gray-400 hover:text-red-500 ml-auto">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Двери/Проход</h3>
              <button onClick={addDoor} className="text-indigo-600 text-sm font-medium hover:text-indigo-700">+ Добавить</button>
            </div>
            {room.doors.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Нет дверей/проходов</div>
            ) : (
              <div className="space-y-3">
                {room.doors.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                    <NumberInput value={d.width} onChange={(v: number) => updateDoor(d.id, 'width', v)} className="w-20" />
                    <span className="text-gray-400">×</span>
                    <NumberInput value={d.height} onChange={(v: number) => updateDoor(d.id, 'height', v)} className="w-20" />
                    <button onClick={() => removeDoor(d.id)} className="p-1 text-gray-400 hover:text-red-500 ml-auto">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Работы и материалы</h3>
        </div>
        <div className="space-y-4 mb-6">
          {(room.works || []).map((work) => {
            // Вычисляем автоматически рассчитанный объем
            let autoQty = 0;
            if (work.calculationType === 'floorArea') autoQty = metrics.floorArea;
            else if (work.calculationType === 'netWallArea') autoQty = metrics.netWallArea;
            else if (work.calculationType === 'skirtingLength') autoQty = metrics.skirtingLength;
            else if (work.calculationType === 'customCount') autoQty = work.count || 0;
            
            // Используем заданный объем или автоматически рассчитанный
            let qty = work.manualQty !== undefined ? work.manualQty : autoQty;
            
            const cost = costs[work.id] || { work: 0, material: 0, tools: 0, total: 0 };
            const isExpanded = expandedWorks.has(work.id);
            const migratedWork = migrateWorkData(work);
            const hasMaterials = (migratedWork.materials?.length || 0) > 0;
            const hasTools = (migratedWork.tools?.length || 0) > 0;

            return (
              <div key={work.id} className={`rounded-xl border transition-colors ${work.enabled ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                {/* Header row */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <input 
                        type="checkbox" 
                        checked={work.enabled} 
                        onChange={e => handleWorkChange(work.id, 'enabled', e.target.checked)} 
                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
                      />
                      <button 
                        onClick={() => toggleWorkExpand(work.id)}
                        className="flex items-center gap-2 flex-1 max-w-sm text-left"
                      >
                        <Settings2 className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        <input 
                          value={work.name} 
                          onChange={e => handleWorkChange(work.id, 'name', e.target.value)} 
                          onClick={e => e.stopPropagation()}
                          className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full"
                          placeholder="Название работы"
                        />
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-indigo-900">{cost.total.toLocaleString('ru-RU')} ₽</div>
                        <div className="text-xs text-gray-500">
                          Р: {cost.work.toLocaleString('ru-RU')} • М: {cost.material.toLocaleString('ru-RU')}
                          {cost.tools > 0 && ` • И: ${cost.tools.toLocaleString('ru-RU')}`}
                        </div>
                      </div>
                      <button onClick={() => removeWork(work.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Expanded content */}
                {work.enabled && isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    {/* Basic work settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Расчет по</label>
                        <select 
                          value={work.calculationType} 
                          onChange={e => {
                            const val = e.target.value as CalculationType;
                            // Атомарное обновление всех полей
                            const newUnit = val === 'floorArea' || val === 'netWallArea' ? 'м²' : val === 'skirtingLength' ? 'пог. м' : 'шт';
                            const updatedWork: WorkData = {
                              ...work,
                              calculationType: val,
                              unit: newUnit,
                            };
                            // Удаляем manualQty при переключении на автоматический режим
                            if (val !== 'customCount') {
                              delete updatedWork.manualQty;
                            }
                            updateRoom({
                              ...room,
                              works: (room.works || []).map(w => w.id === work.id ? updatedWork : w)
                            });
                          }}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="floorArea">Площади пола</option>
                          <option value="netWallArea">Площади стен</option>
                          <option value="skirtingLength">Периметру</option>
                          <option value="customCount">Вручную (шт)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Объем ({work.unit})</label>
                        {work.calculationType === 'customCount' ? (
                          <NumberInput value={work.count || 0} onChange={(v: number) => handleWorkChange(work.id, 'count', v)} className="w-full" />
                        ) : (
                          <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">
                            {autoQty.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Цена работы (за ед.)</label>
                        <div className="relative">
                          <NumberInput value={work.workUnitPrice} onChange={(v: number) => handleWorkChange(work.id, 'workUnitPrice', v)} className="w-full pr-8" />
                          <span className="absolute right-3 top-2 text-gray-400 text-sm">₽</span>
                        </div>
                      </div>
                      <div className="flex items-end">
                        <div className="text-sm text-gray-600">
                          Стоимость работы: <span className="font-semibold text-indigo-900">{(qty * work.workUnitPrice).toLocaleString('ru-RU')} ₽</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Materials section */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-medium text-gray-700">Материалы</h4>
                        {(migratedWork.materials?.length || 0) > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {migratedWork.materials!.reduce((sum, m) => sum + m.quantity * m.pricePerUnit, 0).toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                      
                      {(migratedWork.materials || []).length === 0 ? (
                        <div className="text-sm text-gray-400 italic mb-3 pl-6">Нет материалов</div>
                      ) : (
                        <div className="space-y-2 mb-3 pl-6">
                          {(migratedWork.materials || []).map((material, i) => (
                            <div key={material.id} className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-100">
                              <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                              <input
                                value={material.name}
                                onChange={e => handleMaterialChange(work.id, material.id, 'name', e.target.value)}
                                placeholder="Название"
                                className="flex-1 min-w-[120px] px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
                              />
                              <div className="flex items-center gap-1">
                                <NumberInput
                                  value={material.quantity}
                                  onChange={v => handleMaterialChange(work.id, material.id, 'quantity', v)}
                                  className="w-16 text-sm py-1"
                                  step={0.1}
                                />
                                <input
                                  value={material.unit}
                                  onChange={e => handleMaterialChange(work.id, material.id, 'unit', e.target.value)}
                                  className="w-12 px-1 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm text-center"
                                  placeholder="ед."
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-400 text-xs">×</span>
                                <NumberInput
                                  value={material.pricePerUnit}
                                  onChange={v => handleMaterialChange(work.id, material.id, 'pricePerUnit', v)}
                                  className="w-20 text-sm py-1"
                                />
                                <span className="text-gray-400 text-xs">₽</span>
                              </div>
                              <div className="text-sm text-gray-600 min-w-[80px] text-right">
                                = {(material.quantity * material.pricePerUnit).toLocaleString('ru-RU')} ₽
                              </div>
                              <button
                                onClick={() => removeMaterial(work.id, material.id)}
                                className="p-1 text-gray-300 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => addMaterial(work.id)}
                        className="text-sm text-emerald-600 font-medium hover:text-emerald-700 pl-6"
                      >
                        + Добавить материал
                      </button>
                    </div>

                    {/* Tools section */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Wrench className="w-4 h-4 text-amber-600" />
                        <h4 className="font-medium text-gray-700">Инструменты</h4>
                        {(migratedWork.tools?.length || 0) > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {migratedWork.tools!.reduce((sum, t) => {
                              if (t.isRent && t.rentPeriod) {
                                return sum + t.price * t.quantity * t.rentPeriod;
                              }
                              return sum + t.price * t.quantity;
                            }, 0).toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                      
                      {(migratedWork.tools || []).length === 0 ? (
                        <div className="text-sm text-gray-400 italic mb-3 pl-6">Нет инструментов</div>
                      ) : (
                        <div className="space-y-2 mb-3 pl-6">
                          {(migratedWork.tools || []).map((tool, i) => {
                            const toolCost = tool.isRent && tool.rentPeriod 
                              ? tool.price * tool.quantity * tool.rentPeriod 
                              : tool.price * tool.quantity;
                            
                            return (
                              <div key={tool.id} className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-100">
                                <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                                <input
                                  value={tool.name}
                                  onChange={e => handleToolChange(work.id, tool.id, 'name', e.target.value)}
                                  placeholder="Название"
                                  className="flex-1 min-w-[120px] px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
                                />
                                <div className="flex items-center gap-1">
                                  <NumberInput
                                    value={tool.quantity}
                                    onChange={v => handleToolChange(work.id, tool.id, 'quantity', v)}
                                    className="w-14 text-sm py-1"
                                    min={1}
                                  />
                                  <span className="text-gray-400 text-xs">шт</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <NumberInput
                                    value={tool.price}
                                    onChange={v => handleToolChange(work.id, tool.id, 'price', v)}
                                    className="w-20 text-sm py-1"
                                  />
                                  <span className="text-gray-400 text-xs">₽</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={tool.isRent}
                                      onChange={e => handleToolChange(work.id, tool.id, 'isRent', e.target.checked)}
                                      className="w-4 h-4 text-amber-600 rounded border-gray-300"
                                    />
                                    Аренда
                                  </label>
                                  {tool.isRent && (
                                    <div className="flex items-center gap-1">
                                      <NumberInput
                                        value={tool.rentPeriod || 1}
                                        onChange={v => handleToolChange(work.id, tool.id, 'rentPeriod', v)}
                                        className="w-12 text-sm py-1"
                                        min={1}
                                      />
                                      <span className="text-gray-400 text-xs">дн.</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 min-w-[80px] text-right">
                                  = {toolCost.toLocaleString('ru-RU')} ₽
                                </div>
                                <button
                                  onClick={() => removeTool(work.id, tool.id)}
                                  className="p-1 text-gray-300 hover:text-red-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      <button
                        onClick={() => addTool(work.id)}
                        className="text-sm text-amber-600 font-medium hover:text-amber-700 pl-6"
                      >
                        + Добавить инструмент
                      </button>

                      <div className="flex justify-end">
                        <button
                          onClick={() => toggleWorkExpand(work.id)}
                          className="text-sm text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1"
                        >
                          <ChevronUp className="w-4 h-4" />
                          Свернуть
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Collapsed preview */}
                {work.enabled && !isExpanded && (
                  <div className="px-4 pb-3">
                    <button 
                      onClick={() => toggleWorkExpand(work.id)}
                      className="text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1"
                    >
                      {hasMaterials || hasTools ? (
                        <>
                          {hasMaterials && <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" />{migratedWork.materials!.length}</span>}
                          {hasMaterials && hasTools && <span>•</span>}
                          {hasTools && <span className="inline-flex items-center gap-1"><Wrench className="w-3 h-3" />{migratedWork.tools!.length}</span>}
                          <span className="ml-1">— нажмите для редактирования</span>
                        </>
                      ) : (
                        <span>+ Добавить материалы/инструменты</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button 
          onClick={addCustomWork} 
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all"
        >
          <Plus className="w-5 h-5" />
          Добавить работу
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    updateProjects,
    updateActiveProject,
    isLoading,
    lastSaved,
    saveError
  } = useProjects(initialProjects);
  
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Drag and Drop state for rooms
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Показываем загрузку
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Загрузка проектов...</p>
        </div>
      </div>
    );
  }

  const handleDeleteActiveProject = () => {
    if (projects.length === 1) {
      const newProject = createNewProject();
      updateProjects([newProject]);
      setActiveProjectId(newProject.id);
    } else {
      const newProjects = projects.filter(p => p.id !== activeProjectId);
      updateProjects(newProjects);
      setActiveProjectId(newProjects[0].id);
    }
    setActiveTab('summary');
  };

  const handleImport = (importedProjects: ProjectData[], importedActiveId: string) => {
    updateProjects(importedProjects);
    setActiveProjectId(importedActiveId);
    setActiveTab('summary');
  };

  const handleClearAll = () => {
    StorageManager.clearAll();
    const newProject = createNewProject();
    updateProjects([newProject]);
    setActiveProjectId(newProject.id);
    setActiveTab('summary');
  };

  const updateRoomInProject = (updatedRoom: RoomData) => {
    const updatedProject = {
      ...activeProject,
      rooms: activeProject.rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r)
    };
    updateActiveProject(updatedProject);
  };

  const deleteRoomFromProject = (roomId: string) => {
    const newRooms = activeProject.rooms.filter(r => r.id !== roomId);
    const updatedProject = {
      ...activeProject,
      rooms: newRooms
    };
    updateActiveProject(updatedProject);
    setActiveTab(newRooms.length > 0 ? newRooms[0].id : 'summary');
  };

  const addRoomToProject = () => {
    const newRoom = createNewRoom();
    const updatedProject = {
      ...activeProject,
      rooms: [...activeProject.rooms, newRoom]
    };
    updateActiveProject(updatedProject);
    setActiveTab(newRoom.id);
    setIsMobileMenuOpen(false);
  };

  // Drag and Drop handlers for rooms
  const handleRoomDragStart = (roomId: string) => {
    setDraggedRoomId(roomId);
  };

  const handleRoomDragOver = (e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    if (roomId !== draggedRoomId) {
      setDragOverRoomId(roomId);
    }
  };

  const handleRoomDragLeave = () => {
    setDragOverRoomId(null);
  };

  const handleRoomDrop = (e: React.DragEvent, targetRoomId: string) => {
    e.preventDefault();
    if (!draggedRoomId || draggedRoomId === targetRoomId) {
      setDraggedRoomId(null);
      setDragOverRoomId(null);
      return;
    }

    const rooms = [...activeProject.rooms];
    const draggedIndex = rooms.findIndex(r => r.id === draggedRoomId);
    const targetIndex = rooms.findIndex(r => r.id === targetRoomId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedRoomId(null);
      setDragOverRoomId(null);
      return;
    }

    // Remove dragged room and insert at new position
    const [draggedRoom] = rooms.splice(draggedIndex, 1);
    rooms.splice(targetIndex, 0, draggedRoom);

    const updatedProject = {
      ...activeProject,
      rooms: rooms
    };
    updateActiveProject(updatedProject);
    setDraggedRoomId(null);
    setDragOverRoomId(null);
  };

  const addNewProject = () => {
    const newProject = createNewProject();
    updateProjects([...projects, newProject]);
    setActiveProjectId(newProject.id);
    setActiveTab('summary');
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col md:flex-row font-sans text-gray-900">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-600">
            <Calculator className="w-6 h-6" />
            <span className="font-semibold text-lg">Мой ремонт</span>
          </div>
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Объект</label>
          <select 
            value={activeProjectId}
            onChange={(e) => {
              setActiveProjectId(e.target.value);
              setActiveTab('summary');
              setIsMobileMenuOpen(false);
            }}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 truncate"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Обзор</div>
          <button 
            onClick={() => { setActiveTab('summary'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors ${activeTab === 'summary' ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Общая смета</span>
          </button>

          <div className="px-4 mt-6 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Комнаты</div>
          {activeProject.rooms.map(room => (
            <div
              key={room.id}
              draggable
              onDragStart={() => handleRoomDragStart(room.id)}
              onDragOver={(e) => handleRoomDragOver(e, room.id)}
              onDragLeave={handleRoomDragLeave}
              onDrop={(e) => handleRoomDrop(e, room.id)}
              className={`group flex items-center cursor-move transition-all ${
                draggedRoomId === room.id 
                  ? 'opacity-50' 
                  : dragOverRoomId === room.id 
                    ? 'bg-indigo-100 border-r-2 border-indigo-600' 
                    : ''
              }`}
            >
              <div className="px-2 py-3 text-gray-400 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing">
                <GripVertical className="w-4 h-4" />
              </div>
              <button
                onClick={() => { setActiveTab(room.id); setIsMobileMenuOpen(false); }}
                className={`flex-1 flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  activeTab === room.id
                    ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="truncate pr-2">{room.name}</span>
                <ChevronRight className={`w-4 h-4 ${activeTab === room.id ? 'text-indigo-600' : 'text-gray-400'}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <button 
            onClick={addRoomToProject}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить комнату
          </button>
          <button 
            onClick={addNewProject} 
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all"
          >
            <Plus className="w-4 h-4" /> 
            Новый объект
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <span className="font-semibold text-lg truncate flex-1">
            {activeTab === 'summary' ? activeProject.name : activeProject.rooms.find(r => r.id === activeTab)?.name}
          </span>
          <BackupManager 
            projects={projects}
            activeProjectId={activeProjectId}
            onImport={handleImport}
            onClearAll={handleClearAll}
          />
        </header>

        {/* Desktop header with backup manager */}
        <header className="hidden md:flex bg-white border-b border-gray-200 p-4 items-center justify-between">
          <div className="flex items-center gap-2">
            {lastSaved && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Save className="w-3 h-3" />
                <span>Сохранено {lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {saveError && (
              <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {saveError}
              </div>
            )}
          </div>
          <BackupManager 
            projects={projects}
            activeProjectId={activeProjectId}
            onImport={handleImport}
            onClearAll={handleClearAll}
          />
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {activeTab === 'summary' ? (
              <SummaryView 
                project={activeProject} 
                updateProject={updateActiveProject} 
                deleteProject={handleDeleteActiveProject} 
              />
            ) : (
              activeProject.rooms.find(r => r.id === activeTab) && (
                <RoomEditor 
                  room={activeProject.rooms.find(r => r.id === activeTab)!} 
                  updateRoom={updateRoomInProject}
                  deleteRoom={() => deleteRoomFromProject(activeTab)}
                />
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
