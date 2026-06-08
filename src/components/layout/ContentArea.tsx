import React from 'react';
import { Calculator } from 'lucide-react';
import { SummaryView } from '../SummaryView';
import { RoomEditor } from '../RoomEditor';
import { getAllRooms } from '../../utils/projectObjects';
import type { ProjectData, RoomData } from '../../types';
import type { WorkTemplate } from '../../types/workTemplate';

interface ContentAreaProps {
  projects: ProjectData[];
  activeTab: string;
  activeProject: ProjectData | undefined;
  onCreateProject: () => void;
  onTabChange: (tab: string) => void;
  roomEditorProps: {
    city: string | undefined;
    updateRoom: (room: RoomData) => void;
    updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
    onDeleteRoom: () => void;
    templates: WorkTemplate[];
    onSaveTemplate: (template: WorkTemplate) => void;
    onLoadTemplate: (template: WorkTemplate) => void;
    onDeleteTemplate: (id: string) => void;
    isTemplatePickerOpen: boolean;
    onOpenTemplatePicker: () => void;
    onCloseTemplatePicker: () => void;
  };
}

export function ContentArea({
  projects,
  activeTab,
  activeProject,
  onCreateProject,
  onTabChange,
  roomEditorProps,
}: ContentAreaProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Calculator className="w-16 h-16 text-indigo-300 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Нет проектов</h2>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          Создайте первый проект, чтобы начать расчёт стоимости ремонта
        </p>
        <button
          onClick={onCreateProject}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать проект
        </button>
      </div>
    );
  }

  if (activeTab === 'summary' && activeProject) {
    return (
      <SummaryView
        project={activeProject}
        onRoomClick={onTabChange}
        groupByObject={activeProject.objects && activeProject.objects.length > 1}
      />
    );
  }

  if (activeProject) {
    const room = getAllRooms(activeProject).find(r => r.id === activeTab);
    if (room) {
      return (
        <RoomEditor
          room={room}
          city={activeProject.city}
          updateRoom={roomEditorProps.updateRoom}
          updateRoomById={roomEditorProps.updateRoomById}
          deleteRoom={roomEditorProps.onDeleteRoom}
          templates={roomEditorProps.templates}
          onSaveTemplate={roomEditorProps.onSaveTemplate}
          onLoadTemplate={roomEditorProps.onLoadTemplate}
          onDeleteTemplate={roomEditorProps.onDeleteTemplate}
          isTemplatePickerOpen={roomEditorProps.isTemplatePickerOpen}
          onOpenTemplatePicker={roomEditorProps.onOpenTemplatePicker}
          onCloseTemplatePicker={roomEditorProps.onCloseTemplatePicker}
        />
      );
    }
  }

  return null;
}
