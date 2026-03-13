import React, { useState, useEffect, useRef } from 'react';
import { Plus, Calculator, Menu, X, LayoutDashboard, Save, LogOut, User } from 'lucide-react';
import { RoomList } from './components/rooms/RoomList';
import { SummaryView } from './components/SummaryView';
import { RoomEditor } from './components/RoomEditor';
import { ProjectProvider, useProjectContext } from './contexts/ProjectContext';
import { WorkTemplateProvider, useWorkTemplateContext } from './contexts/WorkTemplateContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoginPage, RegisterPage, ProtectedRoute } from './components/auth';
import type { ProjectData, RoomData } from './types';
import type { WorkTemplate } from './types/workTemplate';
import { createNewProject, createNewRoom } from './utils/factories';
import { BackupManager } from './components/BackupManager';
import { StorageManager } from './utils/storage';

import { initialProjects } from './data/initialData';

/**
 * Страниццы аутентификации
 */
function AuthPages() {
  const [isLogin, setIsLogin] = useState(true);

  return isLogin ? (
    <LoginPage onSwitchToRegister={() => setIsLogin(false)} />
  ) : (
    <RegisterPage onSwitchToLogin={() => setIsLogin(true)} />
  );
}

/**
 * Компонент с пользователем в сайдбаре
 */
function UserSection() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (!user) return null;

  return (
    <div className="p-4 border-t border-gray-200 bg-white shrink-0 relative">
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

/**
 * Внутренний компонент приложения, использующий контексты.
 * Разделён для возможности использования хуков внутри провайдеров.
 */
function AppContent() {
  const {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    updateProjects,
    updateActiveProject,
    updateRoom,
    updateRoomById,
    deleteRoom,
    addRoom,
    reorderRooms,
    isLoading,
    lastSaved,
    saveError
  } = useProjectContext();

  const {
    templates,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
    importTemplates,
  } = useWorkTemplateContext();

  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showRoomNameInHeader, setShowRoomNameInHeader] = useState(false);
  const roomHeaderRef = useRef<HTMLDivElement | null>(null);

  // Track room header visibility - must be called before any early returns
  useEffect(() => {
    if (activeTab === 'summary' || !activeProject) {
      setShowRoomNameInHeader(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowRoomNameInHeader(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: '-100px 0px 0px 0px',
        threshold: 0,
      }
    );

    const roomHeaderElement = document.getElementById('room-header-title');
    if (roomHeaderElement) {
      observer.observe(roomHeaderElement);
    }

    return () => {
      observer.disconnect();
    };
  }, [activeTab, activeProject]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Загрузка проектов...</p>
        </div>
      </div>
    );
  }

  const handleDeleteActiveProject = () => {
    if (projects.length === 1) {
      const newProject = createNewProject();
      updateProjects([newProject]);
      setActiveProjectId(newProject.id);
    } else {
      const newProjects = projects.filter(p => p.id !== activeProjectId);
      updateProjects(newProjects);
      setActiveProjectId(newProjects[0].id);
    }
    setActiveTab('summary');
  };

  const handleImport = (importedProjects: ProjectData[], importedActiveId: string) => {
    updateProjects(importedProjects);
    setActiveProjectId(importedActiveId);
    setActiveTab('summary');
  };

  const handleClearAll = () => {
    StorageManager.clearAll();
    const newProject = createNewProject();
    updateProjects([newProject]);
    setActiveProjectId(newProject.id);
    setActiveTab('summary');
  };

  const handleDeleteRoom = (roomId: string) => {
    deleteRoom(roomId);
    const newActiveTab = activeProject && activeProject.rooms.length > 1 
      ? activeProject.rooms.filter(r => r.id !== roomId)[0]?.id || 'summary'
      : 'summary';
    setActiveTab(newActiveTab);
  };

  const handleAddRoom = () => {
    const newRoom = createNewRoom();
    addRoom(newRoom);
    setActiveTab(newRoom.id);
    setIsMobileMenuOpen(false);
  };

  const addNewProject = () => {
    const newProject = createNewProject();
    updateProjects([...projects, newProject]);
    setActiveProjectId(newProject.id);
    setActiveTab('summary');
    setIsMobileMenuOpen(false);
  };

  const handleImportTemplates = (importedTemplates: WorkTemplate[]) => {
    importTemplates(importedTemplates);
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col md:flex-row font-sans text-gray-900">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col h-screen ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center justify-center bg-white p-4 border-b border-gray-200" style={{ height: 'calc(1rem + 56px + 1rem)' }}>
          <img src="/logo.svg" alt="Мой ремонт" className="h-17 w-auto" />
        </div>

        <div className="p-4 bg-white space-y-3">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Объект</label>
            <button className="md:hidden cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <select
            value={activeProjectId}
            onChange={(e) => {
              setActiveProjectId(e.target.value);
              setActiveTab('summary');
              setIsMobileMenuOpen(false);
            }}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 truncate cursor-pointer"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {/* Город для поиска цен */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Город</label>
            <input
              type="text"
              value={activeProject?.city || ''}
              onChange={(e) => {
                if (activeProject) {
                  updateActiveProject({ ...activeProject, city: e.target.value });
                }
              }}
              placeholder="Для поиска цен"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Статическая часть - Обзор */}
          <div className="py-4 shrink-0">
            <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Обзор</div>
            <button
              onClick={() => { setActiveTab('summary'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors cursor-pointer ${activeTab === 'summary' ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Общая смета</span>
            </button>
          </div>

          {/* Прокручиваемая часть - Комнаты */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Комнаты</div>
            {activeProject && (
              <RoomList
                rooms={activeProject.rooms}
                activeTab={activeTab}
                onRoomClick={(roomId) => {
                  setActiveTab(roomId);
                  setIsMobileMenuOpen(false);
                }}
                onReorderRooms={reorderRooms}
              />
            )}
          </div>
        </div>

        <div className="p-4 space-y-3 bg-white shrink-0">
          <button
            onClick={handleAddRoom}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Добавить комнату
          </button>
          <button
            onClick={addNewProject}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Новый объект
          </button>
        </div>

        {/* User section */}
        <UserSection />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="cursor-pointer">
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <span className="font-semibold text-lg truncate flex-1">
            {activeTab === 'summary' ? activeProject?.name : activeProject?.rooms.find(r => r.id === activeTab)?.name}
          </span>
          <BackupManager
            projects={projects}
            activeProjectId={activeProjectId}
            onImport={handleImport}
            onClearAll={handleClearAll}
            onImportTemplates={handleImportTemplates}
          />
        </header>

        {/* Desktop header with backup manager */}
        <header className="hidden md:flex bg-white border-b border-gray-200 px-4 py-[28px] items-center justify-center relative">
          <div className="text-2xl font-bold text-gray-900 uppercase">
            {activeProject?.name}
            {activeTab !== 'summary' && showRoomNameInHeader && (
              <span className="text-gray-400 font-normal"> / {activeProject.rooms.find(r => r.id === activeTab)?.name}</span>
            )}
          </div>
          <div className="absolute right-4 flex items-center gap-4">
            {lastSaved && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Save className="w-3 h-3" />
                <span>Сохранено {lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {saveError && (
              <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {saveError}
              </div>
            )}
            <BackupManager
              projects={projects}
              activeProjectId={activeProjectId}
              onImport={handleImport}
              onClearAll={handleClearAll}
              onImportTemplates={handleImportTemplates}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {activeTab === 'summary' && activeProject ? (
              <SummaryView
                project={activeProject}
                onRoomClick={(roomId) => setActiveTab(roomId)}
              />
            ) : activeProject?.rooms.find(r => r.id === activeTab) ? (
              <RoomEditor
                room={activeProject.rooms.find(r => r.id === activeTab)!}
                city={activeProject.city}
                updateRoom={updateRoom}
                updateRoomById={updateRoomById}
                deleteRoom={() => handleDeleteRoom(activeTab)}
                templates={templates}
                onSaveTemplate={saveTemplate}
                onLoadTemplate={loadTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                isTemplatePickerOpen={isTemplatePickerOpen}
                onOpenTemplatePicker={() => setIsTemplatePickerOpen(true)}
                onCloseTemplatePicker={() => setIsTemplatePickerOpen(false)}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Корневой компонент приложения с роутингом аутентификации
 */
function AppWithAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  // Показываем загрузку пока проверяем авторизацию
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если не авторизован — показываем страницы аутентификации
  if (!isAuthenticated) {
    return <AuthPages />;
  }

  // Если авторизован — показываем основное приложение
  return (
    <ProjectProvider initialProjects={initialProjects}>
      <WorkTemplateProvider>
        <AppContent />
      </WorkTemplateProvider>
    </ProjectProvider>
  );
}

/**
 * Корневой компонент приложения.
 * Настраивает провайдеры контекстов и Error Boundary.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </ErrorBoundary>
  );
}