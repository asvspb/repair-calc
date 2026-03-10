import React, { useState, useEffect } from 'react';
import { ChevronUp, Wrench, Package, ClipboardList, X, Plus, Trash2, BookOpen, Droplet, Grid3X3 } from 'lucide-react';
import { WorkList } from './works/WorkList';
import { WorkTemplatePickerModal } from './works/WorkTemplatePickerModal';
import { WorkCatalogPicker } from './works/WorkCatalogPicker';
import { MaterialCalculationCard, PaintMaterialCard, TileMaterialCard, MaterialPriceSearch } from './works';
import { NumberInput } from './ui/NumberInput';
import type {
  Opening,
  CalculationType,
  Material,
  Tool,
  WorkData,
  RoomData,
  RoomMetrics,
} from '../types';
import type { WorkTemplate } from '../types/workTemplate';
import type { SaveResult } from '../hooks/useWorkTemplates';
import { calculateRoomMetrics } from '../utils/geometry';
import { calculateRoomCosts, migrateWorkData } from '../utils/costs';
import { createNewMaterial, createNewTool } from '../utils/factories';
import { GeometrySection } from './geometry';
import { useGeometryState } from '../hooks/useGeometryState';

interface RoomEditorProps {
  room: RoomData;
  city?: string;
  updateRoom: (r: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  deleteRoom: () => void;
  templates: WorkTemplate[];
  onSaveTemplate: (work: WorkData, forceReplace: boolean, workVolume?: number) => SaveResult;
  onLoadTemplate: (template: WorkTemplate, metrics?: RoomMetrics) => WorkData;
  onDeleteTemplate: (id: string) => void;
  isTemplatePickerOpen: boolean;
  onOpenTemplatePicker: () => void;
  onCloseTemplatePicker: () => void;
}

export function RoomEditor({
  room,
  city,
  updateRoom,
  updateRoomById,
  deleteRoom,
  templates,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  isTemplatePickerOpen,
  onOpenTemplatePicker,
  onCloseTemplatePicker,
}: RoomEditorProps) {
  // Normalize room data to ensure all arrays exist
  const normalizedRoom = {
    ...room,
    segments: room.segments || [],
    obstacles: room.obstacles || [],
    wallSections: room.wallSections || [],
    subSections: room.subSections || [],
    windows: room.windows || [],
    doors: room.doors || [],
    works: room.works || [],
  };

  const metrics = calculateRoomMetrics(normalizedRoom);
  const { costs, total } = calculateRoomCosts(normalizedRoom);

  // Work expansion state
  const [expandedWorks, setExpandedWorks] = useState<Set<string>>(new Set());

  // Works collapse state
  const [isWorksCollapsed, setIsWorksCollapsed] = useState(false);

  // Catalog picker state
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);

  // Load saved collapse states on mount
  useEffect(() => {
    const savedWorks = sessionStorage.getItem('simpleMode_works_collapsed');
    if (savedWorks !== null) {
      setIsWorksCollapsed(savedWorks === 'true');
    }
  }, []);

  // Save works collapse state on change
  useEffect(() => {
    sessionStorage.setItem('simpleMode_works_collapsed', String(isWorksCollapsed));
  }, [isWorksCollapsed]);

  // Use geometry state hook
  const geometry = useGeometryState(room, updateRoom, updateRoomById);

  // Calculate advanced deltas
  const segmentsDelta = (room.segments || []).reduce(
    (sum, s) => sum + s.length * s.width * (s.operation === 'add' ? 1 : -1),
    0
  );
  const obstaclesDelta = (room.obstacles || []).reduce(
    (sum, o) => sum + o.area * (o.operation === 'add' ? 1 : -1),
    0
  );

  const toggleWorkExpand = (workId: string) => {
    setExpandedWorks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(workId)) {
        newSet.delete(workId);
      } else {
        newSet.add(workId);
      }
      return newSet;
    });
  };

  const handleWorkChange = (
    id: string,
    field: keyof WorkData,
    value: string | number | boolean
  ) => {
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: (prev.works || []).map((w) =>
        w.id === id ? { ...w, [field]: value } : w
      ),
    }));
  };

  // Material handlers
  const handleMaterialChange = (
    workId: string,
    materialId: string,
    field: keyof Material,
    value: string | number
  ) => {
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: (prev.works || []).map((w) => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: (w.materials || []).map((m) =>
            m.id === materialId ? { ...m, [field]: value } : m
          ),
        };
      }),
    }));
  };

  const addMaterial = (workId: string) => {
    const work = (room.works || []).find((w) => w.id === workId);
    const newMaterial = createNewMaterial(work?.unit || 'м²');
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: (prev.works || []).map((w) => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: [...(w.materials || []), newMaterial],
        };
      }),
    }));
  };

  const removeMaterial = (workId: string, materialId: string) => {
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: (prev.works || []).map((w) => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: (w.materials || []).filter((m) => m.id !== materialId),
        };
      }),
    }));
  };

  // Tool handlers
  const handleToolChange = (
    workId: string,
    toolId: string,
    field: keyof Tool,
    value: string | number | boolean
  ) => {
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: (prev.works || []).map((w) => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: (w.tools || []).map((t) =>
            t.id === toolId ? { ...t, [field]: value } : t
          ),
        };
      }),
    }));
  };

  const addTool = (workId: string) => {
    const newTool = createNewTool();
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: (prev.works || []).map((w) => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: [...(w.tools || []), newTool],
        };
      }),
    }));
  };

  const removeTool = (workId: string, toolId: string) => {
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: (prev.works || []).map((w) => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: (w.tools || []).filter((t) => t.id !== toolId),
        };
      }),
    }));
  };

  const addCustomWork = () => {
    const newWork: WorkData = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Работа',
      unit: 'м²',
      enabled: true,
      workUnitPrice: 0,
      materialPriceType: 'total',
      materialPrice: 0,
      materials: [],
      tools: [],
      calculationType: 'floorArea',
      isCustom: true,
    };
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: [...(prev.works || []), newWork],
    }));
  };

  const removeWork = (id: string) => {
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: (prev.works || []).filter((w) => w.id !== id),
    }));
  };

  const reorderWorks = (newWorks: WorkData[]) => {
    updateRoomById(room.id, (prev) => ({
      ...prev,
      works: newWorks,
    }));
  };

  // Template handlers
  const handleSaveTemplate = (work: WorkData, forceReplace: boolean) => {
    let workVolume = 0;
    if (work.calculationType === 'floorArea') workVolume = metrics.floorArea;
    else if (work.calculationType === 'netWallArea')
      workVolume = metrics.netWallArea;
    else if (work.calculationType === 'skirtingLength')
      workVolume = metrics.skirtingLength;
    else if (work.calculationType === 'customCount')
      workVolume = work.count || 0;

    return onSaveTemplate(work, forceReplace, workVolume);
  };

  const handleLoadTemplate = (template: WorkTemplate) => {
    const work = onLoadTemplate(template, metrics);
    updateRoom({
      ...room,
      works: [...(room.works || []), work],
    });
  };

  const handleDeleteTemplate = (id: string) => {
    onDeleteTemplate(id);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Room header */}
      <div id="room-header-title" className="group flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <input
          className="text-2xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full max-w-md"
          value={room.name}
          onChange={(e) => updateRoom({ ...room, name: e.target.value })}
        />
        <button
          onClick={deleteRoom}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Удалить комнату"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Room metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Площадь пола</div>
          <div className="text-xl font-light">
            {metrics.floorArea.toFixed(2)}{' '}
            <span className="text-sm text-gray-400">м²</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Площадь стен</div>
          <div className="text-xl font-light">
            {metrics.netWallArea.toFixed(2)}{' '}
            <span className="text-sm text-gray-400">м²</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Периметр/Плинтус</div>
          <div className="flex items-baseline gap-2">
            <div className="flex flex-col items-center">
              <div className="text-xl font-light">{metrics.perimeter.toFixed(2)}</div>
              <div className="w-10 border-t border-gray-200 my-1"></div>
              <div className="text-xl font-light">
                {metrics.skirtingLength.toFixed(2)}
              </div>
            </div>
            <span className="text-sm text-gray-400">м</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Объем</div>
          <div className="text-xl font-light">
            {metrics.volume?.toFixed(2) || '0.00'}{' '}
            <span className="text-sm text-gray-400">м³</span>
          </div>
        </div>
        <div className="bg-indigo-50 p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm text-indigo-600 mb-1">Стоимость, ₽</div>
          <div className="text-xl font-semibold text-indigo-900">
            {Math.ceil(total).toLocaleString('ru-RU')}{' '}
            <span className="text-sm text-indigo-400"></span>
          </div>
        </div>
      </div>

      {/* Geometry Section */}
      <GeometrySection
        room={room}
        updateRoom={updateRoom}
        updateRoomById={updateRoomById}
        isGeometryCollapsed={geometry.isGeometryCollapsed}
        isExtendedGeometryCollapsed={geometry.isExtendedGeometryCollapsed}
        subSectionsExpanded={geometry.subSectionsExpanded}
        toggleGeometryCollapse={geometry.toggleGeometryCollapse}
        toggleExtendedGeometryCollapse={geometry.toggleExtendedGeometryCollapse}
        toggleSubSectionsExpand={geometry.toggleSubSectionsExpand}
        handleGeometryModeChange={geometry.handleGeometryModeChange}
        updateSimpleField={geometry.updateSimpleField}
        addWindow={geometry.addWindow}
        removeWindow={geometry.removeWindow}
        updateWindow={geometry.updateWindow}
        addDoor={geometry.addDoor}
        removeDoor={geometry.removeDoor}
        updateDoor={geometry.updateDoor}
        addSubSection={geometry.addSubSection}
        removeSubSection={geometry.removeSubSection}
        updateSubSection={geometry.updateSubSection}
        updateSubSectionWindow={geometry.updateSubSectionWindow}
        addSubSectionWindow={geometry.addSubSectionWindow}
        removeSubSectionWindow={geometry.removeSubSectionWindow}
        updateSubSectionDoor={geometry.updateSubSectionDoor}
        addSubSectionDoor={geometry.addSubSectionDoor}
        removeSubSectionDoor={geometry.removeSubSectionDoor}
        addSegment={geometry.addSegment}
        removeSegment={geometry.removeSegment}
        updateSegment={geometry.updateSegment}
        addObstacle={geometry.addObstacle}
        removeObstacle={geometry.removeObstacle}
        updateObstacle={geometry.updateObstacle}
        addWallSection={geometry.addWallSection}
        removeWallSection={geometry.removeWallSection}
        updateWallSection={geometry.updateWallSection}
        segmentsDelta={segmentsDelta}
        obstaclesDelta={obstaclesDelta}
      />

      {/* Works and Materials Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setIsWorksCollapsed(!isWorksCollapsed)}
          >
            <h3 className="text-lg font-medium">Работы и материалы</h3>
            <ChevronUp
              className={`w-5 h-5 text-gray-400 transition-transform ${
                isWorksCollapsed ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {!isWorksCollapsed && (
          <>
            <WorkList
              works={room.works || []}
              costs={costs}
              expandedWorks={expandedWorks}
              onToggleWork={(id) => {
                const work = (room.works || []).find((w) => w.id === id);
                if (work) {
                  handleWorkChange(id, 'enabled', !work.enabled);
                }
              }}
              onDeleteWork={removeWork}
              onNameChange={(id, name) => handleWorkChange(id, 'name', name)}
              onReorderWorks={reorderWorks}
              onToggleExpand={toggleWorkExpand}
              onSaveTemplate={handleSaveTemplate}
              renderExpandedContent={(work) => {
                const migratedWork = migrateWorkData(work);
                let autoQty = 0;
                if (work.calculationType === 'floorArea')
                  autoQty = metrics.floorArea;
                else if (work.calculationType === 'netWallArea')
                  autoQty = metrics.netWallArea;
                else if (work.calculationType === 'skirtingLength')
                  autoQty = metrics.skirtingLength;
                else if (work.calculationType === 'customCount')
                  autoQty = work.count || 0;

                const qty =
                  work.manualQty !== undefined ? work.manualQty : autoQty;

                return (
                  <div className="space-y-6">
                    {/* Basic work settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Расчет по
                        </label>
                        <select
                          value={work.calculationType}
                          onChange={(e) => {
                            const val = e.target.value as CalculationType;
                            const newUnit =
                              val === 'floorArea' || val === 'netWallArea'
                                ? 'м²'
                                : val === 'skirtingLength'
                                ? 'пог. м'
                                : 'шт';
                            updateRoomById(room.id, (prev) => ({
                              ...prev,
                              works: (prev.works || []).map((w) => {
                                if (w.id !== work.id) return w;
                                const updatedWork: WorkData = {
                                  ...w,
                                  calculationType: val,
                                  unit: newUnit,
                                };
                                if (val !== 'customCount') {
                                  delete updatedWork.manualQty;
                                }
                                return updatedWork;
                              }),
                            }));
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
                        <label className="block text-xs text-gray-500 mb-1">
                          Объем ({work.unit})
                        </label>
                        {work.calculationType === 'customCount' ? (
                          <NumberInput
                            value={work.count || 0}
                            onChange={(v: number) =>
                              handleWorkChange(work.id, 'count', v)
                            }
                            className="w-full"
                            step={0.1}
                          />
                        ) : (
                          <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">
                            {autoQty.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Цена работы (за ед.)
                        </label>
                        <div className="relative">
                          <NumberInput
                            value={work.workUnitPrice}
                            onChange={(v: number) =>
                              handleWorkChange(work.id, 'workUnitPrice', v)
                            }
                            className="w-full pr-8"
                            step={0.1}
                          />
                          <span className="absolute right-3 top-2 text-gray-400 text-sm">
                            ₽
                          </span>
                        </div>
                      </div>
                      <div className="flex items-end">
                        <div className="text-sm text-gray-600">
                          Стоимость работы:{' '}
                          <span className="font-semibold text-indigo-900">
                            {Math.ceil(qty * work.workUnitPrice).toLocaleString(
                              'ru-RU'
                            )}{' '}
                            ₽
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Materials section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3 justify-center">
                        <Package className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-medium text-gray-700">Материалы</h4>
                        {(migratedWork.materials?.length || 0) > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {Math.ceil(
                              migratedWork.materials!.reduce(
                                (sum, m) => sum + m.quantity * m.pricePerUnit,
                                0
                              )
                            ).toLocaleString('ru-RU')}{' '}
                            ₽
                          </span>
                        )}
                      </div>

                      {(migratedWork.materials || []).length === 0 ? (
                        <div className="text-sm text-gray-400 italic mb-3">
                          Нет материалов
                        </div>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {(migratedWork.materials || []).map(
                            (material, i) => (
                              <div
                                key={material.id}
                                className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-100"
                              >
                                <span className="text-xs text-gray-400 w-5">
                                  {i + 1}.
                                </span>
                                <input
                                  value={material.name}
                                  onChange={(e) =>
                                    handleMaterialChange(
                                      work.id,
                                      material.id,
                                      'name',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Название"
                                  className="flex-1 min-w-[120px] px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
                                />
                                <div className="flex items-center gap-1">
                                  <NumberInput
                                    value={material.quantity}
                                    onChange={(v) =>
                                      handleMaterialChange(
                                        work.id,
                                        material.id,
                                        'quantity',
                                        v
                                      )
                                    }
                                    className="w-16 text-sm py-1"
                                    step={0.1}
                                  />
                                  <input
                                    value={material.unit}
                                    onChange={(e) =>
                                      handleMaterialChange(
                                        work.id,
                                        material.id,
                                        'unit',
                                        e.target.value
                                      )
                                    }
                                    className="w-12 px-1 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm text-center"
                                    placeholder="ед."
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-400 text-xs">
                                    ×
                                  </span>
                                  <NumberInput
                                    value={material.pricePerUnit}
                                    onChange={(v) =>
                                      handleMaterialChange(
                                        work.id,
                                        material.id,
                                        'pricePerUnit',
                                        v
                                      )
                                    }
                                    className="w-20 text-sm py-1"
                                    step={0.1}
                                  />
                                  <span className="text-gray-400 text-xs">
                                    ₽
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 min-w-[80px] text-right">
                                  ={' '}
                                  {Math.ceil(
                                    material.quantity * material.pricePerUnit
                                  ).toLocaleString('ru-RU')}{' '}
                                  ₽
                                </div>
                                <MaterialPriceSearch
                                  materialName={material.name}
                                  city={city}
                                  onPriceFound={(price) =>
                                    handleMaterialChange(
                                      work.id,
                                      material.id,
                                      'pricePerUnit',
                                      price
                                    )
                                  }
                                />
                                <button
                                  onClick={() =>
                                    removeMaterial(work.id, material.id)
                                  }
                                  className="p-1 text-gray-300 hover:text-red-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => addMaterial(work.id)}
                        className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
                      >
                        + Добавить материал
                      </button>
                    </div>

                    {/* Tools section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3 justify-center">
                        <Wrench className="w-4 h-4 text-amber-600" />
                        <h4 className="font-medium text-gray-700">
                          Инструменты
                        </h4>
                        {(migratedWork.tools?.length || 0) > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {Math.ceil(
                              migratedWork.tools!.reduce((sum, t) => {
                                if (t.isRent && t.rentPeriod) {
                                  return (
                                    sum + t.price * t.quantity * t.rentPeriod
                                  );
                                }
                                return sum + t.price * t.quantity;
                              }, 0)
                            ).toLocaleString('ru-RU')}{' '}
                            ₽
                          </span>
                        )}
                      </div>

                      {(migratedWork.tools || []).length === 0 ? (
                        <div className="text-sm text-gray-400 italic mb-3">
                          Нет инструментов
                        </div>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {(migratedWork.tools || []).map((tool, i) => {
                            const toolCost =
                              tool.isRent && tool.rentPeriod
                                ? tool.price * tool.quantity * tool.rentPeriod
                                : tool.price * tool.quantity;

                            return (
                              <div
                                key={tool.id}
                                className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-100"
                              >
                                <span className="text-xs text-gray-400 w-5">
                                  {i + 1}.
                                </span>
                                <input
                                  value={tool.name}
                                  onChange={(e) =>
                                    handleToolChange(
                                      work.id,
                                      tool.id,
                                      'name',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Название"
                                  className="flex-1 min-w-[120px] px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
                                />
                                <div className="flex items-center gap-1">
                                  <NumberInput
                                    value={tool.quantity}
                                    onChange={(v) =>
                                      handleToolChange(
                                        work.id,
                                        tool.id,
                                        'quantity',
                                        v
                                      )
                                    }
                                    className="w-14 text-sm py-1"
                                    min={1}
                                  />
                                  <span className="text-gray-400 text-xs">
                                    шт
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <NumberInput
                                    value={tool.price}
                                    onChange={(v) =>
                                      handleToolChange(
                                        work.id,
                                        tool.id,
                                        'price',
                                        v
                                      )
                                    }
                                    className="w-20 text-sm py-1"
                                  />
                                  <span className="text-gray-400 text-xs">
                                    ₽
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={tool.isRent}
                                      onChange={(e) =>
                                        handleToolChange(
                                          work.id,
                                          tool.id,
                                          'isRent',
                                          e.target.checked
                                        )
                                      }
                                      className="w-4 h-4 text-amber-600 rounded border-gray-300"
                                    />
                                    Аренда
                                  </label>
                                  {tool.isRent && (
                                    <div className="flex items-center gap-1">
                                      <NumberInput
                                        value={tool.rentPeriod || 1}
                                        onChange={(v) =>
                                          handleToolChange(
                                            work.id,
                                            tool.id,
                                            'rentPeriod',
                                            v
                                          )
                                        }
                                        className="w-12 text-sm py-1"
                                        min={1}
                                      />
                                      <span className="text-gray-400 text-xs">
                                        дн.
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 min-w-[80px] text-right">
                                  ={' '}
                                  {Math.ceil(toolCost).toLocaleString('ru-RU')}{' '}
                                  ₽
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
                        className="text-sm text-amber-600 font-medium hover:text-amber-700"
                      >
                        + Добавить инструмент
                      </button>
                    </div>
                  </div>
                );
              }}
            />

            <button
              onClick={addCustomWork}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Новая работа
            </button>

            <button
              onClick={() => setIsCatalogPickerOpen(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl font-medium hover:bg-emerald-100 hover:border-emerald-200 transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              Из каталога работ
            </button>

            <button
              onClick={onOpenTemplatePicker}
              disabled={templates.length === 0}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={
                templates.length === 0
                  ? 'Нет сохранённых шаблонов'
                  : 'Загрузить из шаблона'
              }
            >
              <ClipboardList className="w-4 h-4" />
              Работа по шаблону
            </button>
          </>
        )}
      </div>

      {/* Catalog Picker Modal */}
      <WorkCatalogPicker
        isOpen={isCatalogPickerOpen}
        onClose={() => setIsCatalogPickerOpen(false)}
        onSelect={(work) => {
          updateRoom({
            ...room,
            works: [...(room.works || []), work],
          });
        }}
        roomMetrics={metrics}
      />

      {/* Template Picker Modal */}
      <WorkTemplatePickerModal
        isOpen={isTemplatePickerOpen}
        onClose={onCloseTemplatePicker}
        onSelect={handleLoadTemplate}
        templates={templates}
        onLoadTemplate={onLoadTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        roomMetrics={metrics}
      />
    </div>
  );
}
