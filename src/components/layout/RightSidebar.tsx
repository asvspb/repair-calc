import React from 'react';
import { X, Plus, LogOut, User, FolderOpen, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ProjectSettings } from './ProjectSettings';
import { OtherObjectsSection } from './ObjectSettings';
import type { ProjectData, ObjectData } from '../../types';

type RightSidebarProps = {
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isSyncing: boolean;
  onProjectChange: (id: string) => void;
  onRenameProject: (name: string) => void;
  onDeleteProject: () => void;
  onNewProject: () => void;
  onOpenProjects: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  objects: ObjectData[];
  activeObjectId: string | null;
  activeObject: ObjectData | null;
  onObjectChange: (id: string) => void;
  showDeleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
};

/**
 * User section component for the right sidebar
 */
function UserSection() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = React.useState(false);

  if (!user) return null;

  return (
    <div className="p-4 border-t border-gray-200 bg-white shrink-0 relative mt-auto">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
          <User className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {user.name || 'Пользователь'}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {user.email}
          </div>
        </div>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute bottom-full left-4 right-4 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <button
              onClick={async () => {
                setShowMenu(false);
                await logout();
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function RightSidebar({
  isMobileMenuOpen,
  onMobileMenuClose,
  projects,
  activeProjectId,
  activeProject,
  isSyncing,
  onProjectChange,
  onRenameProject,
  onDeleteProject,
  onNewProject,
  onOpenProjects,
  activeTab,
  onTabChange,
  objects,
  activeObjectId,
  activeObject,
  onObjectChange,
  showDeleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
}: RightSidebarProps) {
  return (
    <>
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Удалить проект?</h3>
            <p className="text-gray-600 mb-4">
              Проект «{activeProject?.name}» будет удалён безвозвратно.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onDeleteCancel}
                disabled={isSyncing}
                className="flex-1 py-2 px-4 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>
              <button
                onClick={onDeleteConfirm}
                disabled={isSyncing}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Удаление...</span>
                  </>
                ) : (
                  <span>Удалить</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-white border-l border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col h-screen ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 border-b border-gray-200 bg-white shrink-0" style={{ height: 'calc(1rem + 56px + 1rem)' }}>
          <button
            onClick={onOpenProjects}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Мои проекты"
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-sm">Мои проекты</span>
          </button>
          <button className="md:hidden cursor-pointer" onClick={onMobileMenuClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Overview section */}
          <div className="py-4 shrink-0 border-b border-gray-200">
            <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Обзор</div>
            <button
              onClick={() => onTabChange('summary')}
              className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Общая смета</span>
            </button>
          </div>

          {/* Project Settings */}
          <ProjectSettings
            projects={projects}
            activeProjectId={activeProjectId}
            activeProject={activeProject}
            isSyncing={isSyncing}
            onProjectChange={onProjectChange}
            onRename={onRenameProject}
            onDelete={onDeleteProject}
            onNewProject={onNewProject}
          />

          {/* Other Objects Section */}
          <OtherObjectsSection
            objects={objects}
            activeObjectId={activeObjectId}
            onObjectClick={onObjectChange}
          />
        </div>

        {/* Action buttons */}
        <div className="p-4 space-y-3 bg-white shrink-0">
          <button
            onClick={onNewProject}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Новый проект
          </button>
        </div>

        {/* User section */}
        <UserSection />
      </aside>
    </>
  );
}
