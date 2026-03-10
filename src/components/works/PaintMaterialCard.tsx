/**
 * PaintMaterialCard - специализированная карточка для краски
 * Поддерживает слои и показывает варианты упаковки
 */

import React, { memo, useState, useMemo } from 'react';
import { Droplet, Layers, Info, RefreshCw } from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';
import type { Material, RoomMetrics } from '../../types';
import { calculateByConsumption } from '../../utils/materialCalculations';

type CalculationType = 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';

type Props = {
  material: Material;
  index: number;
  metrics: RoomMetrics;
  calculationType?: CalculationType;
  onChange: (field: keyof Material, value: string | number | boolean) => void;
  onRemove: () => void;
};

// Стандартные размеры банок краски
const STANDARD_CAN_SIZES = [0.5, 0.9, 2.5, 5, 10, 20];

/**
 * Карточка для краски с поддержкой слоёв
 */
const PaintMaterialCardInternal: React.FC<Props> = ({
  material,
  index,
  metrics,
  calculationType = 'floorArea',
  onChange,
  onRemove,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCanSize, setSelectedCanSize] = useState<number>(
    material.packageSize || 10
  );

  // Определяем площадь для расчёта
  const area = getAreaForType(calculationType, metrics);
  
  // Параметры краски
  const consumptionRate = material.consumptionRate || 0.006; // л/м² по умолчанию
  const layers = material.layers || 2;
  const wastePercent = material.wastePercent || 5;

  // Вычисляем нужное количество краски
  const calculation = useMemo(() => {
    const rawQty = area * consumptionRate * layers;
    const withWaste = rawQty * (1 + wastePercent / 100);
    const total = Math.ceil(withWaste * 100) / 100;
    
    // Подбираем количество банок
    const cansNeeded = Math.ceil(total / selectedCanSize);
    
    return {
      totalLiters: total,
      cansNeeded,
      coverageArea: selectedCanSize / consumptionRate / layers,
      formula: `${area} м² × ${consumptionRate} л/м² × ${layers} слоёв × ${(1 + wastePercent / 100).toFixed(2)} = ${total.toFixed(2)} л`,
    };
  }, [area, consumptionRate, layers, wastePercent, selectedCanSize]);

  // Обработчик изменения размера банки
  const handleCanSizeChange = (size: number) => {
    setSelectedCanSize(size);
    onChange('packageSize', size);
  };

  // Применить расчёт
  const handleApplyCalculation = () => {
    onChange('quantity', calculation.cansNeeded);
    onChange('packageSize', selectedCanSize);
  };

  return (
    <div className="flex flex-wrap items-start gap-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100 hover:border-purple-200 transition-colors">
      {/* Номер и иконка */}
      <div className="flex items-center gap-1.5 w-auto">
        <span className="text-xs text-gray-400">{index + 1}.</span>
        <Droplet className="w-4 h-4 text-purple-400" />
      </div>

      {/* Название материала */}
      <div className="flex-1 min-w-[140px]">
        <input
          value={material.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Название краски"
          className="w-full px-1 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none text-sm"
        />
        
        {/* Параметры слоёв */}
        <div className="mt-1 flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Layers className="w-3 h-3" />
            <span>Слои:</span>
            <select
              value={layers}
              onChange={(e) => onChange('layers', parseInt(e.target.value))}
              className="bg-transparent border-b border-gray-200 focus:border-purple-500 outline-none text-xs"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Детали расчёта */}
      {showDetails && (
        <div className="w-full ml-5 p-2 bg-white/50 rounded text-xs space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Площадь:</span>
            <span>{area.toFixed(2)} м²</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Расход на слой:</span>
            <span>{consumptionRate} л/м²</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Всего слоёв:</span>
            <span>{layers}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Запас:</span>
            <span>{wastePercent}%</span>
          </div>
          <div className="border-t border-purple-100 pt-1 mt-1 text-purple-600 font-mono">
            {calculation.formula}
          </div>
        </div>
      )}

      {/* Варианты упаковки */}
      <div className="w-full ml-5 flex flex-wrap gap-1.5 my-2">
        {STANDARD_CAN_SIZES.map((size) => {
          const cans = Math.ceil(calculation.totalLiters / size);
          const isSelected = selectedCanSize === size;
          
          return (
            <button
              key={size}
              onClick={() => handleCanSizeChange(size)}
              className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-purple-50 border border-gray-200'
              }`}
            >
              {size} л {size >= 5 && `(${cans} шт)`}
            </button>
          );
        })}
      </div>

      {/* Рекомендация */}
      <div className="w-full ml-5 flex items-center gap-2 p-2 bg-purple-100/50 rounded text-xs">
        <span className="text-purple-700">
          💡 Нужно: <strong>{calculation.totalLiters.toFixed(2)} л</strong>
          {' → '}
          <strong>{calculation.cansNeeded} банка(и)</strong> по {selectedCanSize} л
        </span>
        <button
          onClick={handleApplyCalculation}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-purple-200 text-purple-700 rounded hover:bg-purple-300 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Применить
        </button>
      </div>

      {/* Количество и цена */}
      <div className="flex items-center gap-1">
        <NumberInput
          value={material.quantity}
          onChange={(v) => onChange('quantity', v)}
          className="w-14 text-sm py-1"
          min={1}
        />
        <span className="text-xs text-gray-400">банок</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-gray-400 text-xs">×</span>
        <NumberInput
          value={material.pricePerUnit}
          onChange={(v) => onChange('pricePerUnit', v)}
          className="w-20 text-sm py-1"
          step={0.1}
        />
        <span className="text-gray-400 text-xs">₽</span>
      </div>

      {/* Итого */}
      <div className="text-sm text-purple-700 font-medium min-w-[80px] text-right">
        = {Math.ceil(material.quantity * material.pricePerUnit).toLocaleString('ru-RU')} ₽
      </div>

      {/* Кнопка удаления */}
      <button
        onClick={onRemove}
        className="p-1 text-gray-300 hover:text-red-500 cursor-pointer"
        title="Удалить материал"
      >
        ×
      </button>
    </div>
  );
};

/**
 * Определяет площадь по типу расчёта
 */
function getAreaForType(type: CalculationType, metrics: RoomMetrics): number {
  switch (type) {
    case 'floorArea':
      return metrics.floorArea;
    case 'netWallArea':
      return metrics.netWallArea;
    case 'skirtingLength':
      return metrics.perimeter;
    default:
      return metrics.floorArea;
  }
}

export const PaintMaterialCard = memo(PaintMaterialCardInternal, (prev, next) => {
  return (
    prev.material.id === next.material.id &&
    prev.material.name === next.material.name &&
    prev.material.quantity === next.material.quantity &&
    prev.material.pricePerUnit === next.material.pricePerUnit &&
    prev.material.layers === next.material.layers &&
    prev.index === next.index &&
    prev.calculationType === next.calculationType &&
    prev.metrics.floorArea === next.metrics.floorArea &&
    prev.metrics.netWallArea === next.metrics.netWallArea
  );
});