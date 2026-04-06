import React from 'react';
import { Plus, X, LayoutDashboard } from 'lucide-react';
import { RoomList } from '../rooms/RoomList';
import type { RoomData } from '../../types';

type LeftSidebarProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddRoom: () => void;
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
  rooms: RoomData[];
  onReorderRooms: (rooms: RoomData[]) => void;
};

export function LeftSidebar({
  activeTab,
  onTabChange,
  onAddRoom,
  isMobileMenuOpen,
  onMobileMenuClose,
  rooms,
  onReorderRooms,
}: LeftSidebarProps) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col h-screen ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo with mobile close button */}
      <div className="flex items-center justify-between px-4 border-b border-gray-200 bg-white shrink-0" style={{ height: 'calc(1rem + 56px + 1rem)' }}>
        <div className="w-6 md:hidden" /> {/* Spacer for balance */}
        <img src="/logo.svg" alt="Мой ремонт" className="h-17 w-auto" />
        <button className="cursor-pointer md:hidden" onClick={onMobileMenuClose}>
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Overview section */}
        <div className="py-4 shrink-0">
          <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Обзор</div>
          <button
            onClick={() => onTabChange('summary')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Общая смета</span>
          </button>
        </div>

        {/* Rooms section */}
        <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Комнаты</div>
        {rooms.length > 0 && (
          <RoomList
            rooms={rooms}
            activeTab={activeTab}
            onRoomClick={(roomId) => onTabChange(roomId)}
            onReorderRooms={onReorderRooms}
          />
        )}

      </div>

      {/* Add room button */}
      <div className="p-4 bg-white shrink-0">
        <button
          onClick={onAddRoom}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Добавить комнату
        </button>
      </div>
    </aside>
  );
}
