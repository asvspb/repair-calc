import React from 'react';
import { Menu, Settings, ChevronRight } from 'lucide-react';
import { getAllRooms } from '../../utils/projectObjects';
import type { ObjectData, ProjectData } from '../../types';

interface AppHeaderProps {
  activeTab: string;
  activeProject: ProjectData | undefined;
  activeObject: ObjectData | undefined;
  showRoomNameInHeader: boolean;
  onOpenLeftMobileMenu: () => void;
  onOpenRightMobileMenu: () => void;
}

export function AppHeader({
  activeTab,
  activeProject,
  activeObject,
  showRoomNameInHeader,
  onOpenLeftMobileMenu,
  onOpenRightMobileMenu,
}: AppHeaderProps) {
  return (
    <>
      <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button data-testid="mobile-menu-btn" onClick={onOpenLeftMobileMenu} className="cursor-pointer">
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm font-medium truncate">
            <span className="truncate">{activeProject?.name}</span>
            {activeTab !== 'summary' && activeProject && (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-gray-500 truncate">
                  {getAllRooms(activeProject).find(r => r.id === activeTab)?.name}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          data-testid="mobile-settings-btn"
          onClick={onOpenRightMobileMenu}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0"
          title="Настройки"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <header className="hidden md:flex bg-white border-b border-gray-200 px-4 items-center justify-center relative h-[88px]">
        <div className="flex items-center gap-2 text-2xl font-bold text-gray-900 uppercase">
          <span>{activeProject?.name || ''}</span>
          {activeObject && activeProject?.objects && activeProject.objects.length > 1 && (
            <>
              <ChevronRight className="w-5 h-5 text-gray-400 font-normal" />
              <span className="text-gray-600">{activeObject.name}</span>
            </>
          )}
          {activeTab !== 'summary' && showRoomNameInHeader && activeProject && (
            <>
              <ChevronRight className="w-5 h-5 text-gray-400 font-normal" />
              <span className="text-gray-400 font-normal">
                {getAllRooms(activeProject).find(r => r.id === activeTab)?.name}
              </span>
            </>
          )}
        </div>
      </header>
    </>
  );
}
