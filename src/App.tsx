import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Menu, Settings, Save, ChevronRight } from 'lucide-react';
import { SummaryView } from './components/SummaryView';
import { RoomEditor } from './components/RoomEditor';
import { ProjectProvider, useProjectContext } from './contexts/ProjectContext';
import { WorkTemplateProvider, useWorkTemplateContext } from './contexts/WorkTemplateContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoginPage, RegisterPage, ProtectedRoute } from './components/auth';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import type { ProjectData, RoomData, ObjectData } from './types';
import type { WorkTemplate } from './types/workTemplate';
import { createNewProject, createNewRoom } from './utils/factories';
import { StorageManager } from './utils/storage';
import { IdMapper } from './utils/idMapper';
import { getAllRooms, migrateProjectToObjects } from './utils/projectObjects';
import { CreateObjectModal } from './components/objects/CreateObjectModal';
import { ProjectsModal } from './components/projects';
import { DataManagementModal } from './components/projects/DataManagementModal';

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
    deleteProject,
    addRoom,
    reorderRooms,
    isLoading,
    lastSaved,
    lastSavedToServer,
    saveError,
    isSyncing,
    // New object management
    activeObjectId,
    activeObject,
    setActiveObjectId,
    createObject,
    updateObject,
    deleteObject,
    copyObject,
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
  const [isLeftMobileMenuOpen, setIsLeftMobileMenuOpen] = useState(false);
  const [isRightMobileMenuOpen, setIsRightMobileMenuOpen] = useState(false);
  const [showRoomNameInHeader, setShowRoomNameInHeader] = useState(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  const [isCreateObjectModalOpen, setIsCreateObjectModalOpen] = useState(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isDataManagementModalOpen, setIsDataManagementModalOpen] = useState(false);
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
    const newProjects = projects.filter(p => p.id !== activeProjectId);
    updateProjects(newProjects);
    if (newProjects.length > 0) {
      setActiveProjectId(newProjects[0].id);
    } else {
      setActiveProjectId('');
    }
    setActiveTab('summary');
  };

  const handleImport = (importedProjects: ProjectData[], importedActiveId: string) => {
    // Выполняем миграцию импортированных проектов на новую структуру с objects
    const migratedProjects = importedProjects.map(project => migrateProjectToObjects(project));
    updateProjects(migratedProjects);
    setActiveProjectId(importedActiveId);
    setActiveTab('summary');
  };

  const handleClearAll = () => {
    StorageManager.clearAll();
    updateProjects([]);
    setActiveProjectId('');
    setActiveTab('summary');
  };

  const handleDeleteRoom = (roomId: string) => {
    deleteRoom(roomId);
    const allRooms = activeProject ? getAllRooms(activeProject) : [];
    const remainingRooms = allRooms.filter(r => r.id !== roomId);
    const newActiveTab = remainingRooms.length > 1
      ? remainingRooms[0]?.id || 'summary'
      : 'summary';
    setActiveTab(newActiveTab);
  };

  const handleAddRoom = () => {
    const newRoom = createNewRoom();
    addRoom(newRoom);
    setActiveTab(newRoom.id);
    setIsLeftMobileMenuOpen(false);
  };

  const openCreateProjectModal = () => {
    setIsProjectsModalOpen(true);
    setIsRightMobileMenuOpen(false);
  };

  const handleCopyProject = (id: string) => {
    const sourceProject = projects.find(p => p.id === id);
    if (!sourceProject) return;

    const copiedProject = JSON.parse(JSON.stringify(sourceProject));
    copiedProject.id = `local-${Date.now()}`;
    copiedProject.name = `${sourceProject.name} (копия)`;

    // Re-generate IDs for objects and rooms to avoid conflicts
    if (copiedProject.objects) {
      copiedProject.objects = copiedProject.objects.map((obj: any) => ({
        ...obj,
        id: `obj-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        projectId: copiedProject.id,
        rooms: obj.rooms?.map((room: any) => ({
          ...room,
          id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          objectId: obj.id,
        })),
      }));
    }

    const updatedProjects = [...projects, copiedProject];
    updateProjects(updatedProjects);
    setActiveProjectId(copiedProject.id);
  };

  const handleImportTemplates = (importedTemplates: WorkTemplate[]) => {
    importTemplates(importedTemplates);
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col md:flex-row font-sans text-gray-900">
      {/* Left Sidebar */}
      <LeftSidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setIsLeftMobileMenuOpen(false);
        }}
        onAddRoom={handleAddRoom}
        isMobileMenuOpen={isLeftMobileMenuOpen}
        onMobileMenuClose={() => setIsLeftMobileMenuOpen(false)}
        rooms={activeObject?.rooms || []}
        onReorderRooms={reorderRooms}
        objects={activeProject?.objects || []}
        activeObjectId={activeObjectId}
        activeObject={activeObject}
        onObjectChange={(id) => {
          setActiveObjectId(id);
          setActiveTab('summary');
        }}
        onAddObject={() => setIsCreateObjectModalOpen(true)}
        city={activeObject?.city || activeProject?.city || ''}
        onCityChange={(city) => {
          if (activeObject) {
            updateObject(activeObject.id, { city: city || undefined });
          } else if (activeProject) {
            updateActiveProject({ ...activeProject, city });
          }
        }}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center gap-3">
          <button onClick={() => setIsLeftMobileMenuOpen(true)} className="cursor-pointer">
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
            onClick={() => setIsRightMobileMenuOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Настройки"
          >
            <Settings className="w-5 h-5" />
          </button>
        </header>

        {/* Desktop header with breadcrumbs */}
        <header className="hidden md:flex bg-white border-b border-gray-200 px-4 items-center justify-center relative h-[88px]">
          <div className="flex items-center gap-2 text-2xl font-bold text-gray-900 uppercase">
            {/* Project name */}
            <span>
              {activeProject?.name || ''}
            </span>

            {/* Object breadcrumb (show if multiple objects or not on summary) */}
            {activeObject && activeProject?.objects && activeProject.objects.length > 1 && (
              <>
                <ChevronRight className="w-5 h-5 text-gray-400 font-normal" />
                <span className="text-gray-600">{activeObject.name}</span>
              </>
            )}

            {/* Room breadcrumb */}
            {activeTab !== 'summary' && showRoomNameInHeader && activeProject && (
              <>
                <ChevronRight className="w-5 h-5 text-gray-400 font-normal" />
                <span className="text-gray-400 font-normal">
                  {getAllRooms(activeProject).find(r => r.id === activeTab)?.name}
                </span>
              </>
            )}
          </div>
          <div className="absolute right-4 flex items-center gap-4">
            {lastSaved && (
              <div className="flex items-center gap-1 text-xs"
                title={lastSavedToServer ? 'Сохранено в базу данных' : 'Сохранено локально'}>
                <Save className={`w-3 h-3 ${lastSavedToServer ? 'text-green-600' : 'text-gray-500'}`} />
                <span className="text-gray-500">Сохранено {lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {saveError && (
              <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {saveError}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {/* Empty state - no projects */}
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Calculator className="w-16 h-16 text-indigo-300 mb-6" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Нет проектов</h2>
                <p className="text-gray-500 mb-6 text-center max-w-md">
                  Создайте первый проект, чтобы начать расчёт стоимости ремонта
                </p>
                <button
                  onClick={openCreateProjectModal}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Создать проект
                </button>
              </div>
            ) : activeTab === 'summary' && activeProject ? (
              <SummaryView
                project={activeProject}
                onRoomClick={(roomId) => setActiveTab(roomId)}
                groupByObject={activeProject.objects && activeProject.objects.length > 1}
              />
            ) : activeProject && getAllRooms(activeProject).find(r => r.id === activeTab) ? (
              <RoomEditor
                room={getAllRooms(activeProject).find(r => r.id === activeTab)!}
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

      {/* Right Sidebar */}
      <RightSidebar
        isMobileMenuOpen={isRightMobileMenuOpen}
        onMobileMenuClose={() => setIsRightMobileMenuOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        activeProject={activeProject}
        isSyncing={isSyncing}
        onProjectChange={(id) => {
          setActiveProjectId(id);
          setActiveTab('summary');
        }}
        onRenameProject={(id, name) => {
          const updatedProjects = projects.map(p =>
            p.id === id ? { ...p, name } : p
          );
          updateProjects(updatedProjects);
        }}
        onDeleteProject={(id) => {
          setProjectToDeleteId(id);
        }}
        onCopyProject={handleCopyProject}
        onNewProject={openCreateProjectModal}
        onDataManagement={() => setIsDataManagementModalOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        objects={activeProject?.objects || []}
        activeObjectId={activeObjectId}
        activeObject={activeObject}
        onObjectChange={(id) => {
          setActiveObjectId(id);
          setActiveTab('summary');
        }}
        showDeleteConfirm={projectToDeleteId !== null}
        projectToDeleteId={projectToDeleteId}
        onDeleteConfirm={async () => {
          if (!projectToDeleteId) return;
          if (isSyncing) return;

          if (IdMapper.isServerId(projectToDeleteId)) {
            await deleteProject(projectToDeleteId);
          }
          const updatedProjects = projects.filter(p => p.id !== projectToDeleteId);
          updateProjects(updatedProjects);

          // If the active project was deleted, select the first available one
          if (projectToDeleteId === activeProjectId && updatedProjects.length > 0) {
            setActiveProjectId(updatedProjects[0].id);
          } else if (updatedProjects.length === 0) {
            setActiveProjectId('');
          }

          setProjectToDeleteId(null);
          setActiveTab('summary');
        }}
        onDeleteCancel={() => setProjectToDeleteId(null)}
      />

      {/* Create Object Modal */}
      {isCreateObjectModalOpen && (
        <CreateObjectModal
          onClose={() => setIsCreateObjectModalOpen(false)}
        />
      )}

      {/* Projects Modal */}
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        onImportTemplates={handleImportTemplates}
      />

      {/* Data Management Modal */}
      <DataManagementModal
        isOpen={isDataManagementModalOpen}
        onClose={() => setIsDataManagementModalOpen(false)}
        onImportTemplates={handleImportTemplates}
      />
    </div>
  );
}

/**
 * Корневой компонент приложения с роутингом аутентификации
 */
function AppWithAuth() {
  const { isAuthenticated, isLoading, user } = useAuth();

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
  // key={user?.id} обеспечивает пересоздание ProjectProvider при смене пользователя
  return (
    <ProjectProvider key={user?.id} initialProjects={initialProjects}>
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