/**
 * MaterialCalculationCard - карточка материала с авто-расчётом
 * Поддерживает различные типы расчёта и показывает рекомендованное количество
 */

import React, { memo, useState, useEffect } from 'react';
import { RefreshCw, Info, Lightbulb, ToggleLeft, ToggleRight } from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';
import type { Material, RoomMetrics } from '../../types';
import {
  useMaterialCalculation,
  formatFormula,
} from '../../hooks/useMaterialCalculation';

type CalculationType = 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';

type Props = {
  material: Material;
  index: number;
  metrics: RoomMetrics;
  calculationType?: CalculationType;
  customCount?: number;
  onChange: (field: keyof Material, value: string | number | boolean) => void;
  onRemove: () => void;
};

/**
 * Карточка материала с авто-расчётом
 */
const MaterialCalculationCardInternal: React.FC<Props> = ({
  material,
  index,
  metrics,
  calculationType = 'floorArea',
  customCount,
  onChange,
  onRemove,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // Вычисляем рекомендованное количество
  const calculation = useMaterialCalculation({
    material,
    metrics,
    calculationType,
    customCount,
  });

  // Определяем площадь для отображения
  const area = getDisplayArea(calculationType, metrics);

  // Проверяем, отличается ли текущее количество от рекомендованного
  const hasDifference = calculation.isCalculated && 
    Math.abs(material.quantity - calculation.recommendedQty) > 0.01;

  // Обработчик применения рекомендованного количества
  const handleApplyRecommended = () => {
    onChange('quantity', calculation.recommendedQty);
  };

  // Переключение авто-расчёта
  const handleToggleAutoCalc = () => {
    onChange('autoCalcEnabled', !material.autoCalcEnabled);
  };

  // Определяем тип материала для UI
  const materialType = getMaterialType(material);
  const MaterialIcon = getMaterialIcon(materialType);

  return (
    <div className="flex flex-wrap items-start gap-2 p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
      {/* Номер */}
      <span className="text-xs text-gray-400 w-5 pt-1.5">
        {index + 1}.
      </span>

      {/* Название материала */}
      <div className="flex-1 min-w-[140px]">
        <div className="flex items-center gap-1.5">
          <MaterialIcon className="w-4 h-4 text-gray-400" />
          <input
            value={material.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Название материала"
            className="w-full px-1 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
          />
        </div>
        
        {/* Параметры расчёта */}
        {calculation.canAutoCalculate && (
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={handleToggleAutoCalc}
              className={`flex items-center gap-1 text-xs cursor-pointer transition-colors ${
                material.autoCalcEnabled 
                  ? 'text-indigo-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title={material.autoCalcEnabled ? 'Авто-расчёт включён' : 'Авто-расчёт выключен'}
            >
              {material.autoCalcEnabled ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
              Авто
            </button>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Детали расчёта (развёрнутые) */}
      {showDetails && calculation.isCalculated && (
        <div className="w-full ml-5 p-2 bg-indigo-50 rounded text-xs space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Площадь:</span>
            <span>{area.toFixed(2)} м²</span>
          </div>
          {material.coveragePerUnit && (
            <div className="flex justify-between text-gray-600">
              <span>Покрытие ед.:</span>
              <span>{material.coveragePerUnit} м²</span>
            </div>
          )}
          {material.consumptionRate && (
            <div className="flex justify-between text-gray-600">
              <span>Расход:</span>
              <span>{material.consumptionRate} {material.unit}/м²</span>
            </div>
          )}
          {material.layers && material.layers > 1 && (
            <div className="flex justify-between text-gray-600">
              <span>Слои:</span>
              <span>{material.layers}</span>
            </div>
          )}
          {material.wastePercent !== undefined && material.wastePercent > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Запас:</span>
              <span>{material.wastePercent}%</span>
            </div>
          )}
          <div className="border-t border-indigo-100 pt-1 mt-1">
            <span className="text-gray-500">Формула: </span>
            <span className="text-indigo-600 font-mono">
              {formatFormula(calculation.formula)}
            </span>
          </div>
        </div>
      )}

      {/* Рекомендованное количество */}
      {calculation.isCalculated && hasDifference && material.autoCalcEnabled && (
        <div className="w-full ml-5 flex items-center gap-2 p-2 bg-amber-50 rounded text-xs">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="text-amber-700">
            Рекомендуется: <strong>{calculation.recommendedQty} {material.unit}</strong>
          </span>
          <button
            onClick={handleApplyRecommended}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Применить
          </button>
        </div>
      )}

      {/* Количество и единица */}
      <div className="flex items-center gap-1">
        <NumberInput
          value={material.quantity}
          onChange={(v) => onChange('quantity', v)}
          className="w-16 text-sm py-1"
          step={0.1}
        />
        <input
          value={material.unit}
          onChange={(e) => onChange('unit', e.target.value)}
          className="w-12 px-1 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm text-center"
          placeholder="ед."
        />
      </div>

      {/* Цена */}
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
      <div className="text-sm text-gray-600 min-w-[80px] text-right">
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
 * Определяет площадь для отображения
 */
function getDisplayArea(type: CalculationType, metrics: RoomMetrics): number {
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

/**
 * Определяет тип материала для UI
 */
type MaterialType = 'coverage' | 'consumption' | 'perimeter' | 'custom';

function getMaterialType(material: Material): MaterialType {
  if (material.coveragePerUnit) return 'coverage';
  if (material.consumptionRate) return 'consumption';
  if (material.isPerimeter) return 'perimeter';
  return 'custom';
}

/**
 * Возвращает иконку для типа материала
 */
function getMaterialIcon(type: MaterialType): React.FC<{ className?: string }> {
  const icons: Record<MaterialType, React.FC<{ className?: string }>> = {
    coverage: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    ),
    consumption: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M2 12h20" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
    perimeter: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3h18v18H3z" />
        <path d="M3 9h18M9 3v18" strokeDasharray="4 2" />
      </svg>
    ),
    custom: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l2 2" />
      </svg>
    ),
  };
  
  return icons[type];
}

/**
 * Экспортируемый компонент с мемоизацией
 */
export const MaterialCalculationCard = memo(MaterialCalculationCardInternal, (prev, next) => {
  return (
    prev.material.id === next.material.id &&
    prev.material.name === next.material.name &&
    prev.material.quantity === next.material.quantity &&
    prev.material.pricePerUnit === next.material.pricePerUnit &&
    prev.material.autoCalcEnabled === next.material.autoCalcEnabled &&
    prev.index === next.index &&
    prev.calculationType === next.calculationType &&
    prev.customCount === next.customCount &&
    prev.metrics.floorArea === next.metrics.floorArea &&
    prev.metrics.netWallArea === next.metrics.netWallArea &&
    prev.metrics.perimeter === next.metrics.perimeter
  );
});