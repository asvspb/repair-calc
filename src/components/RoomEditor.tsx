import React, { useState, useEffect, useMemo } from 'react';
import { ChevronUp, Plus, BookOpen, ClipboardList } from 'lucide-react';
import { WorkList } from './works/WorkList';
import { WorkCard } from './works/WorkCard';
import type { WorkCardHandlers } from './works/WorkCard';
import { WorkTemplatePickerModal } from './works/WorkTemplatePickerModal';
import { WorkCatalogPicker } from './works/WorkCatalogPicker';
import { RoomHeader } from './room/RoomHeader';
import { RoomMetricsSummary } from './room/RoomMetricsSummary';
import { useRoomWorksState } from './room/useRoomWorksState';
import { GeometrySection } from './geometry';
import { useGeometryState } from '../hooks/useGeometryState';
import { calculateRoomMetrics } from '../domain/geometry/geometry';
import { calculateRoomCosts } from '../domain/pricing/costs';
import type { RoomMetrics } from '../types';
import type { RoomData, WorkData } from '@shared/types';
import type { WorkTemplate } from '../types/workTemplate';
import type { SaveResult } from '../hooks/useWorkTemplates';
import { useProjectStore } from '../store/useProjectStore';

interface RoomEditorProps {
  room: RoomData;
  city?: string;
  updateRoom: (r: RoomData) => void;

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
  deleteRoom,
  templates,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  isTemplatePickerOpen,
  onOpenTemplatePicker,
  onCloseTemplatePicker,
}: RoomEditorProps) {
  const updateRoomById = useProjectStore(s => s.updateRoomById);

  // Добавляем флаг монтирования для предотвращения hydration ошибок
  const normalizedRoom = useMemo(
    () => ({
      ...room,
      length: room.length ?? 0,
      width: room.width ?? 0,
      height: room.height ?? 0,
      segments: room.segments || [],
      obstacles: room.obstacles || [],
      wallSections: room.wallSections || [],
      subSections: room.subSections || [],
      windows: room.windows || [],
      doors: room.doors || [],
      works: room.works || [],
    }),
    [room],
  );

  const metrics = useMemo(() => calculateRoomMetrics(normalizedRoom), [normalizedRoom]);
  const { costs, total } = useMemo(() => calculateRoomCosts(normalizedRoom), [normalizedRoom]);

  const [expandedWorks, setExpandedWorks] = useState<Set<string>>(new Set());
  const [isWorksCollapsed, setIsWorksCollapsed] = useState(false);
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);

  useEffect(() => {
    const savedWorks = sessionStorage.getItem('simpleMode_works_collapsed');
    if (savedWorks !== null) {
      setIsWorksCollapsed(savedWorks === 'true');
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('simpleMode_works_collapsed', String(isWorksCollapsed));
  }, [isWorksCollapsed]);

  const geometry = useGeometryState(room, updateRoom, updateRoomById);
  const worksState = useRoomWorksState(room, updateRoomById);

  const segmentsDelta = (room.segments || []).reduce(
    (sum, s) => sum + s.length * s.width * (s.operation === 'add' ? 1 : -1),
    0,
  );
  const obstaclesDelta = (room.obstacles || []).reduce(
    (sum, o) => sum + o.area * (o.operation === 'add' ? 1 : -1),
    0,
  );

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

  const handleSaveTemplate = (work: WorkData, forceReplace: boolean) => {
    let workVolume = 0;
    if (work.calculationType === 'floorArea') workVolume = metrics.floorArea;
    else if (work.calculationType === 'netWallArea') workVolume = metrics.netWallArea;
    else if (work.calculationType === 'skirtingLength') workVolume = metrics.skirtingLength;
    else if (work.calculationType === 'customCount') workVolume = work.count || 0;
    return onSaveTemplate(work, forceReplace, workVolume);
  };

  const handleLoadTemplate = (work: WorkData) => {
    updateRoom({ ...room, works: [...(room.works || []), work] });
  };

  const handleDeleteTemplate = (id: string) => {
    onDeleteTemplate(id);
  };

  const handlers: WorkCardHandlers = {
    handleWorkChange: worksState.handleWorkChange,
    handleMaterialChange: worksState.handleMaterialChange,
    addMaterial: worksState.addMaterial,
    removeMaterial: worksState.removeMaterial,
    handleToolChange: worksState.handleToolChange,
    addTool: worksState.addTool,
    removeTool: worksState.removeTool,
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <RoomHeader room={room} onUpdateRoom={updateRoom} onDelete={deleteRoom} />
      <RoomMetricsSummary metrics={metrics} total={total} />

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
              onToggleWork={id => {
                const work = (room.works || []).find(w => w.id === id);
                if (work) {
                  worksState.handleWorkChange(id, 'enabled', !work.enabled);
                }
              }}
              onDeleteWork={worksState.removeWork}
              onNameChange={(id, name) => worksState.handleWorkChange(id, 'name', name)}
              onReorderWorks={worksState.reorderWorks}
              onToggleExpand={toggleWorkExpand}
              onSaveTemplate={handleSaveTemplate}
              renderExpandedContent={work => (
                <WorkCard
                  work={work}
                  roomId={room.id}
                  city={city}
                  handlers={handlers}
                  metrics={metrics}
                />
              )}
            />

            <button
              onClick={worksState.addCustomWork}
              data-testid="add-work-custom-btn"
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
              data-testid="templates-btn"
              disabled={templates.length === 0}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={templates.length === 0 ? 'Нет сохранённых шаблонов' : 'Загрузить из шаблона'}
            >
              <ClipboardList className="w-4 h-4" />
              Работа по шаблону
            </button>
          </>
        )}
      </div>

      <WorkCatalogPicker
        isOpen={isCatalogPickerOpen}
        onClose={() => setIsCatalogPickerOpen(false)}
        onSelect={work => {
          updateRoom({ ...room, works: [...(room.works || []), work] });
        }}
        roomMetrics={metrics}
      />

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
