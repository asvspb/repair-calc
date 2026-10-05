import React, { useEffect, useState } from 'react';
import { ChevronUp, Plus, BookOpen, ClipboardList } from 'lucide-react';
import { WorkList } from './WorkList';
import { WorkCard } from './WorkCard';
import type { WorkCardHandlers } from './WorkCard';
import { WorkTemplatePickerModal } from './WorkTemplatePickerModal';
import { WorkCatalogPicker } from './WorkCatalogPicker';
import { useRoomWorksState } from '../model/useRoomWorksState';
import type { RoomMetrics, RoomCosts } from '../../../types';
import type { RoomData, WorkData } from '@shared/types';
import type { WorkTemplate } from '../../../types/workTemplate';
import type { SaveResult } from '../model/useWorkTemplates';

/**
 * Works-панель комнаты (список работ, карточки, пикеры каталога/шаблонов).
 *
 * R4 batch 031: выделена из RoomEditor (features/rooms) по FSD-паттерну
 * «композиция вверх» — rooms больше не импортирует works; панель монтируется
 * слотом на уровне app-композиции (ContentArea). Все room-данные приходят
 * через props, никаких импортов из features/rooms.
 */
interface RoomWorksSectionProps {
  room: RoomData;
  city?: string;
  updateRoom: (r: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  metrics: RoomMetrics;
  costs: RoomCosts;
  templates: WorkTemplate[];
  onSaveTemplate: (work: WorkData, forceReplace: boolean, workVolume?: number) => SaveResult;
  onLoadTemplate: (template: WorkTemplate, metrics?: RoomMetrics) => WorkData;
  onDeleteTemplate: (id: string) => void;
  isTemplatePickerOpen: boolean;
  onOpenTemplatePicker: () => void;
  onCloseTemplatePicker: () => void;
}

export function RoomWorksSection({
  room,
  city,
  updateRoom,
  updateRoomById,
  metrics,
  costs,
  templates,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  isTemplatePickerOpen,
  onOpenTemplatePicker,
  onCloseTemplatePicker,
}: RoomWorksSectionProps) {
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

  const worksState = useRoomWorksState(room, updateRoomById);

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
