/**
 * TileMaterialCard - специализированная карточка для плитки
 * Поддерживает расчёт по размеру плитки и варианты упаковки
 */

import React, { memo, useState, useMemo } from 'react';
import { Grid3X3, Info, RefreshCw } from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';
import type { Material, RoomMetrics } from '../../types';

type CalculationType = 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';

type Props = {
  material: Material;
  index: number;
  metrics: RoomMetrics;
  calculationType?: CalculationType;
  onChange: (field: keyof Material, value: string | number | boolean) => void;
  onRemove: () => void;
};

// Стандартные размеры плитки (см)
const STANDARD_TILE_SIZES = [
  { name: '30×30', width: 30, height: 30 },
  { name: '60×60', width: 60, height: 60 },
  { name: '20×40', width: 20, height: 40 },
  { name: '25×40', width: 25, height: 40 },
  { name: '60×120', width: 60, height: 120 },
  { name: '15×15', width: 15, height: 15 },
];

/**
 * Карточка для плитки с расчётом по размеру
 */
const TileMaterialCardInternal: React.FC<Props> = ({
  material,
  index,
  metrics,
  calculationType = 'floorArea',
  onChange,
  onRemove,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [tileWidth, setTileWidth] = useState(30); // см
  const [tileHeight, setTileHeight] = useState(30); // см
  const [tilesPerBox, setTilesPerBox] = useState(9); // плиток в коробке

  // Определяем площадь для расчёта
  const area = getAreaForType(calculationType, metrics);
  
  // Параметры
  const wastePercent = material.wastePercent || 10;

  // Вычисляем нужное количество плитки
  const calculation = useMemo(() => {
    // Площадь одной плитки в м²
    const tileAreaM2 = (tileWidth / 100) * (tileHeight / 100);
    
    // Количество плиток на площадь
    const tilesNeeded = Math.ceil((area / tileAreaM2) * (1 + wastePercent / 100));
    
    // Количество коробок
    const boxesNeeded = Math.ceil(tilesNeeded / tilesPerBox);
    
    // Площадь в коробке
    const boxArea = tilesPerBox * tileAreaM2;
    
    // Итоговая площадь с запасом
    const totalArea = boxesNeeded * boxArea;
    
    return {
      tileAreaM2,
      tilesNeeded,
      boxesNeeded,
      boxArea,
      totalArea,
      tilesPerBox,
      formula: `${area} м² ÷ ${tileAreaM2.toFixed(3)} м² × ${(1 + wastePercent / 100).toFixed(2)} = ${tilesNeeded} плиток`,
    };
  }, [area, tileWidth, tileHeight, tilesPerBox, wastePercent]);

  // Обработчик изменения размера плитки
  const handleTileSizeChange = (preset: typeof STANDARD_TILE_SIZES[0] | null, w?: number, h?: number) => {
    if (preset) {
      setTileWidth(preset.width);
      setTileHeight(preset.height);
    } else if (w && h) {
      setTileWidth(w);
      setTileHeight(h);
    }
  };

  // Применить расчёт
  const handleApplyCalculation = () => {
    onChange('quantity', calculation.boxesNeeded);
    onChange('coveragePerUnit', calculation.boxArea);
  };

  return (
    <div className="flex flex-wrap items-start gap-2 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100 hover:border-amber-200 transition-colors">
      {/* Номер и иконка */}
      <div className="flex items-center gap-1.5 w-auto">
        <span className="text-xs text-gray-400">{index + 1}.</span>
        <Grid3X3 className="w-4 h-4 text-amber-500" />
      </div>

      {/* Название материала */}
      <div className="flex-1 min-w-[140px]">
        <input
          value={material.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Название плитки"
          className="w-full px-1 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none text-sm"
        />
        
        {/* Параметры размера */}
        <div className="mt-1 flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Размер:</span>
            <input
              type="number"
              value={tileWidth}
              onChange={(e) => handleTileSizeChange(null, parseInt(e.target.value) || 30, tileHeight)}
              className="w-10 bg-transparent border-b border-gray-200 focus:border-amber-500 outline-none text-center"
            />
            ×
            <input
              type="number"
              value={tileHeight}
              onChange={(e) => handleTileSizeChange(null, tileWidth, parseInt(e.target.value) || 30)}
              className="w-10 bg-transparent border-b border-gray-200 focus:border-amber-500 outline-none text-center"
            />
            <span>см</span>
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
            <span>Размер плитки:</span>
            <span>{tileWidth}×{tileHeight} см = {calculation.tileAreaM2.toFixed(3)} м²</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Плиток в м²:</span>
            <span>{(1 / calculation.tileAreaM2).toFixed(2)} шт</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Запас:</span>
            <span>{wastePercent}%</span>
          </div>
          <div className="border-t border-amber-100 pt-1 mt-1 text-amber-600 font-mono">
            {calculation.formula}
          </div>
        </div>
      )}

      {/* Пресеты размеров */}
      <div className="w-full ml-5 flex flex-wrap gap-1.5 my-2">
        {STANDARD_TILE_SIZES.map((preset) => {
          const isSelected = tileWidth === preset.width && tileHeight === preset.height;
          
          return (
            <button
              key={preset.name}
              onClick={() => handleTileSizeChange(preset)}
              className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-amber-50 border border-gray-200'
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* Плиток в коробке */}
      <div className="w-full ml-5 flex items-center gap-2 text-xs">
        <span className="text-gray-500">Плиток в коробке:</span>
        <input
          type="number"
          value={tilesPerBox}
          onChange={(e) => setTilesPerBox(parseInt(e.target.value) || 1)}
          className="w-12 px-1 py-0.5 bg-white border border-gray-200 rounded text-center focus:border-amber-500 outline-none"
        />
        <span className="text-gray-400">= {calculation.boxArea.toFixed(2)} м²</span>
      </div>

      {/* Рекомендация */}
      <div className="w-full ml-5 flex items-center gap-2 p-2 bg-amber-100/50 rounded text-xs">
        <span className="text-amber-700">
          💡 Нужно: <strong>{calculation.tilesNeeded} плиток</strong>
          {' → '}
          <strong>{calculation.boxesNeeded} коробок</strong> ({calculation.totalArea.toFixed(1)} м²)
        </span>
        <button
          onClick={handleApplyCalculation}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-amber-200 text-amber-700 rounded hover:bg-amber-300 cursor-pointer"
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
        <span className="text-xs text-gray-400">коробок</span>
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
      <div className="text-sm text-amber-700 font-medium min-w-[80px] text-right">
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

export const TileMaterialCard = memo(TileMaterialCardInternal, (prev, next) => {
  return (
    prev.material.id === next.material.id &&
    prev.material.name === next.material.name &&
    prev.material.quantity === next.material.quantity &&
    prev.material.pricePerUnit === next.material.pricePerUnit &&
    prev.index === next.index &&
    prev.calculationType === next.calculationType &&
    prev.metrics.floorArea === next.metrics.floorArea &&
    prev.metrics.netWallArea === next.metrics.netWallArea
  );
});