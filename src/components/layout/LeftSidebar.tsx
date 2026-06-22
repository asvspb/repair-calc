import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, FileText } from 'lucide-react';
import { logUserAction } from '../../utils/logger';
import { RoomList } from '../rooms/RoomList';
import { ObjectSettings } from './ObjectSettings';
import type { RoomData, ObjectData } from '@shared/types';

type LeftSidebarProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddRoom: () => void;
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
  rooms: RoomData[];
  onReorderRooms: (rooms: RoomData[]) => void;
  objects: ObjectData[];
  activeObjectId: string | null;
  activeObject: ObjectData | null;
  onObjectChange: (id: string) => void;
  onAddObject: () => void;
  city: string;
  onCityChange: (city: string) => void;
  hasProjects: boolean;
  onDeleteObject?: (id: string) => void;
};

export function LeftSidebar({
  activeTab,
  onTabChange,
  onAddRoom,
  isMobileMenuOpen,
  onMobileMenuClose,
  rooms,
  onReorderRooms,
  objects,
  activeObjectId,
  activeObject,
  onObjectChange,
  onAddObject,
  city,
  onCityChange,
  hasProjects,
  onDeleteObject,
}: LeftSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col h-screen ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo with mobile close button */}
      <div
        className="flex items-center justify-between px-4 border-b border-gray-200 bg-white shrink-0"
        style={{ height: 'calc(1rem + 56px + 1rem)' }}
      >
        <div className="w-6 md:hidden" /> {/* Spacer for balance */}
        <img src="/logo.svg" alt={t('sidebar.myRepair')} className="h-17 w-auto" />
        <button className="cursor-pointer md:hidden" onClick={onMobileMenuClose}>
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Object and City section */}
        <ObjectSettings
          objects={objects}
          activeObjectId={activeObjectId}
          activeObject={activeObject}
          onObjectChange={onObjectChange}
          onAddObject={onAddObject}
          city={city}
          onCityChange={onCityChange}
          hasProjects={hasProjects}
          onDeleteObject={onDeleteObject}
        />

        {/* Object Estimate NavLink */}
        <div className="py-2 border-b border-gray-200 shrink-0">
          <button
            data-testid="nav-object-estimate"
            onClick={() => {
              logUserAction('nav_object_estimate', { objectId: activeObjectId });
              onTabChange('object-estimate');
            }}
            disabled={!activeObjectId}
            className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors ${
              activeTab === 'object-estimate'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            } ${!activeObjectId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <FileText className="w-5 h-5" />
            <span className="truncate">{t('sidebar.objectEstimate')}</span>
          </button>
        </div>

        {/* Rooms section */}
        <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {t('sidebar.rooms')}
        </div>
        {rooms.length > 0 && (
          <RoomList
            rooms={rooms}
            activeTab={activeTab}
            onRoomClick={roomId => onTabChange(roomId)}
            onReorderRooms={onReorderRooms}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="p-4 space-y-3 bg-white shrink-0">
        <button
          onClick={onAddRoom}
          disabled={!hasProjects}
          data-testid="add-room-btn"
          title={!hasProjects ? t('sidebar.createProjectFirst') : ''}
          className={`w-full flex items-center justify-center gap-2 py-2.5 border rounded-xl font-medium transition-all shadow-sm ${
            hasProjects
              ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 cursor-pointer'
              : 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4" />
          {t('sidebar.addRoom')}
        </button>
        <button
          onClick={onAddObject}
          disabled={!hasProjects}
          data-testid="add-object-btn"
          title={!hasProjects ? t('sidebar.createProjectFirst') : ''}
          className={`w-full flex items-center justify-center gap-2 py-2.5 border rounded-xl font-medium transition-all ${
            hasProjects
              ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 cursor-pointer'
              : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed shadow-none'
          }`}
        >
          <Plus className="w-4 h-4" />
          {t('sidebar.addObject')}
        </button>
      </div>
    </aside>
  );
}
