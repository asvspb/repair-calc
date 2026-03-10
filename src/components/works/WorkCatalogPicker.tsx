/**
 * WorkCatalogPicker - модальное окно для выбора работы из каталога типовых работ
 * Позволяет выбрать работу из предопределённого каталога с автоматическим расчётом материалов
 */

import React, { useState, useMemo } from 'react';
import { X, Search, Package, Wrench, Clock, Star, Info } from 'lucide-react';
import type { WorkTemplateCatalog, WorkCategory, Difficulty } from '../../types/workTemplate';
import { WORK_CATEGORY_LABELS, DIFFICULTY_LABELS } from '../../types/workTemplate';
import type { WorkData, Material, Tool, RoomMetrics } from '../../types';
import { WORK_TEMPLATES_CATALOG, searchWorks, getWorksByCategory, getPopularWorks } from '../../data/workTemplatesCatalog';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (work: WorkData) => void;
  roomMetrics: RoomMetrics;
};

// Категории для фильтрации
const CATEGORIES: (WorkCategory | 'all' | 'popular')[] = ['popular', 'all', 'floor', 'walls', 'ceiling', 'openings', 'other'];

const CATEGORY_ICONS: Record<WorkCategory | 'all' | 'popular', string> = {
  popular: '⭐',
  all: '📋',
  floor: '🏠',
  walls: '🧱',
  ceiling: '💡',
  openings: '🚪',
  other: '🔧',
};

// Цвета сложности
const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'text-green-600 bg-green-50',
  medium: 'text-yellow-600 bg-yellow-50',
  hard: 'text-red-600 bg-red-50',
};

/**
 * Конвертирует WorkTemplateCatalog в WorkData с расчётом материалов по метрикам помещения
 */
export function catalogToWorkData(template: WorkTemplateCatalog, metrics: RoomMetrics): WorkData {
  // Определяем объём работы на основе типа расчёта
  let workVolume = 0;
  let perimeter = 0;
  
  switch (template.calculationType) {
    case 'floorArea':
      workVolume = metrics.floorArea;
      break;
    case 'netWallArea':
      workVolume = metrics.netWallArea;
      break;
    case 'skirtingLength':
      workVolume = metrics.skirtingLength;
      break;
    case 'customCount':
      workVolume = 1; // По умолчанию 1 штука
      break;
  }
  
  perimeter = metrics.perimeter || metrics.skirtingLength || 0;

  // Конвертируем материалы
  const materials: Material[] = template.materials.map((mat) => {
    let quantity = 0;

    if (mat.coveragePerUnit) {
      // Расчёт по площади покрытия (обои, ламинат, плитка)
      const area = template.calculationType === 'floorArea' ? metrics.floorArea : metrics.netWallArea;
      const rawQty = area / mat.coveragePerUnit;
      quantity = Math.ceil(rawQty * (1 + (mat.wastePercent || 0) / 100) * 100) / 100;
    } else if (mat.consumptionRate) {
      // Расчёт по расходу на м² (краска, клей, затирка)
      const area = template.calculationType === 'floorArea' ? metrics.floorArea : metrics.netWallArea;
      const layers = mat.layers || 1;
      const rawQty = area * mat.consumptionRate * layers;
      quantity = Math.ceil(rawQty * (1 + (mat.wastePercent || 0) / 100) * 100) / 100;
    } else if (mat.isPerimeter && mat.multiplier) {
      // Расчёт по периметру (плинтус, профили)
      const rawQty = perimeter * mat.multiplier;
      if (mat.packageSize) {
        // Если указана длина одной штуки
        quantity = Math.ceil(rawQty * (1 + (mat.wastePercent || 0) / 100) / mat.packageSize);
      } else {
        quantity = Math.ceil(rawQty * (1 + (mat.wastePercent || 0) / 100) * 100) / 100;
      }
    } else if (mat.piecesPerUnit && mat.consumptionRate) {
      // Крепёж и т.п.
      const area = template.calculationType === 'floorArea' ? metrics.floorArea : metrics.netWallArea;
      const rawQty = area * mat.consumptionRate;
      quantity = Math.ceil(rawQty / mat.piecesPerUnit);
    } else {
      // По умолчанию - 1 единица
      quantity = 1;
    }

    return {
      id: `mat-${Math.random().toString(36).substring(2, 9)}`,
      name: mat.name,
      quantity: Math.max(quantity, 0.01),
      unit: mat.unit,
      pricePerUnit: mat.defaultPrice || 0,
    };
  });

  // Конвертируем инструменты
  const tools: Tool[] = (template.tools || []).filter(Boolean).map((tool) => ({
    id: `tool-${Math.random().toString(36).substring(2, 9)}`,
    name: tool.name,
    quantity: 1,
    price: tool.defaultPrice || 0,
    isRent: tool.isRentDefault,
    rentPeriod: tool.defaultRentPeriod,
  }));

  return {
    id: `work-${Math.random().toString(36).substring(2, 9)}`,
    name: template.name,
    unit: template.unit,
    enabled: true,
    workUnitPrice: template.defaultWorkPrice || 0,
    materialPriceType: 'total',
    materialPrice: 0,
    materials,
    tools,
    calculationType: template.calculationType,
    count: template.calculationType === 'customCount' ? 1 : undefined,
    isCustom: false,
    catalogId: template.id, // Сохраняем ссылку на каталог
  };
}

export function WorkCatalogPicker({ isOpen, onClose, onSelect, roomMetrics }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WorkCategory | 'all' | 'popular'>('popular');
  const [selectedWork, setSelectedWork] = useState<WorkTemplateCatalog | null>(null);

  // Фильтрация работ
  const filteredWorks = useMemo(() => {
    let result: WorkTemplateCatalog[];

    if (selectedCategory === 'popular') {
      result = getPopularWorks(10);
    } else if (selectedCategory === 'all') {
      result = WORK_TEMPLATES_CATALOG;
    } else {
      result = getWorksByCategory(selectedCategory);
    }

    // Поиск по названию
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (work) =>
          work.name.toLowerCase().includes(query) ||
          work.description?.toLowerCase().includes(query)
      );
    }

    // Сортировка по популярности
    return [...result].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }, [selectedCategory, searchQuery]);

  const handleSelect = (work: WorkTemplateCatalog) => {
    setSelectedWork(work);
  };

  const handleAdd = () => {
    if (!selectedWork) return;
    const workData = catalogToWorkData(selectedWork, roomMetrics);
    onSelect(workData);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedCategory('popular');
    setSelectedWork(null);
    onClose();
  };

  // Расчёт примерной стоимости материалов
  const estimateMaterialsCost = (work: WorkTemplateCatalog): number => {
    const tempWorkData = catalogToWorkData(work, roomMetrics);
    return tempWorkData.materials.reduce((sum, m) => sum + m.quantity * m.pricePerUnit, 0);
  };

  // Расчёт примерной стоимости работы
  const estimateWorkCost = (work: WorkTemplateCatalog): number => {
    let volume = 0;
    switch (work.calculationType) {
      case 'floorArea':
        volume = roomMetrics.floorArea;
        break;
      case 'netWallArea':
        volume = roomMetrics.netWallArea;
        break;
      case 'skirtingLength':
        volume = roomMetrics.skirtingLength;
        break;
      case 'customCount':
        volume = 1;
        break;
    }
    return volume * (work.defaultWorkPrice || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Каталог работ</h2>
            <p className="text-sm text-gray-500">Выберите работу для добавления в комнату</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск работы..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{CATEGORY_ICONS[cat]}</span>
                {cat === 'popular' ? 'Популярные' : cat === 'all' ? 'Все' : WORK_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Works list */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredWorks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Работы не найдены</p>
                <p className="text-sm text-gray-400 mt-1">Попробуйте изменить поисковый запрос</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredWorks.map((work) => (
                  <div
                    key={work.id}
                    onClick={() => handleSelect(work)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedWork?.id === work.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-transparent bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800">{work.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded">
                            {WORK_CATEGORY_LABELS[work.category]}
                          </span>
                          {work.difficulty && (
                            <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[work.difficulty]}`}>
                              {DIFFICULTY_LABELS[work.difficulty]}
                            </span>
                          )}
                        </div>
                        {work.description && (
                          <p className="text-sm text-gray-500 mt-1">{work.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {work.materials.length} материалов
                          </span>
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3.5 h-3.5" />
                            {work.tools.length} инструментов
                          </span>
                          {work.estimatedTimePerUnit && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              ~{work.estimatedTimePerUnit} ч/м²
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            {work.defaultWorkPrice?.toLocaleString('ru-RU') || 0} ₽/{work.unit}
                          </span>
                        </div>
                      </div>
                      {work.popularity && work.popularity >= 80 && (
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Work details panel */}
          {selectedWork && (
            <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
              <h3 className="font-semibold text-gray-800 mb-3">{selectedWork.name}</h3>
              
              {selectedWork.description && (
                <p className="text-sm text-gray-600 mb-4">{selectedWork.description}</p>
              )}

              {/* Estimated costs */}
              <div className="bg-white rounded-lg p-3 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Работа:</span>
                  <span className="font-medium text-indigo-600">
                    ~{Math.ceil(estimateWorkCost(selectedWork)).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Материалы:</span>
                  <span className="font-medium text-emerald-600">
                    ~{Math.ceil(estimateMaterialsCost(selectedWork)).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                  <span>Итого:</span>
                  <span className="text-gray-800">
                    ~{Math.ceil(estimateWorkCost(selectedWork) + estimateMaterialsCost(selectedWork)).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Materials preview */}
              {selectedWork.materials.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <Package className="w-4 h-4 text-emerald-600" />
                    Материалы
                  </h4>
                  <div className="space-y-1.5">
                    {selectedWork.materials.slice(0, 5).map((mat) => (
                      <div key={mat.id} className="text-sm text-gray-600 flex justify-between">
                        <span className="truncate">{mat.name}</span>
                        {mat.defaultPrice && (
                          <span className="text-gray-400 text-xs">
                            {mat.defaultPrice.toLocaleString('ru-RU')} ₽/{mat.unit}
                          </span>
                        )}
                      </div>
                    ))}
                    {selectedWork.materials.length > 5 && (
                      <p className="text-xs text-gray-400">
                        + ещё {selectedWork.materials.length - 5} материалов
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tools preview */}
              {(selectedWork.tools?.filter(Boolean).length ?? 0) > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    Инструменты
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWork.tools.filter(Boolean).map((tool) => (
                      <span
                        key={tool.id}
                        className="text-xs px-2 py-0.5 bg-white rounded text-gray-600"
                      >
                        {tool.name}
                        {tool.isRentDefault && ' (аренда)'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              {selectedWork.materials.some((m) => m.tips) && (
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <h4 className="text-sm font-medium text-blue-700 mb-1 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    Подсказки
                  </h4>
                  <ul className="text-xs text-blue-600 space-y-1">
                    {selectedWork.materials
                      .filter((m) => m.tips)
                      .map((m) => (
                        <li key={m.id}>• {m.tips}</li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Add button */}
              <button
                onClick={handleAdd}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Добавить работу
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Всего работ в каталоге: {WORK_TEMPLATES_CATALOG.length}
          </p>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}