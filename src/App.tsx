import React, { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { useProjectStore, resetStore } from './store/useProjectStore';
import { WorkTemplateProvider, useWorkTemplateContext } from './contexts/WorkTemplateContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoginPage, RegisterPage } from './components/auth';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { ContentArea } from './components/layout/ContentArea';
import { CreateObjectModal } from './components/objects/CreateObjectModal';
import { ProjectsModal } from './components/projects';
import { DataManagementModal } from './components/projects/DataManagementModal';
import { useRoomHeaderVisibility } from './hooks/ui/useRoomHeaderVisibility';
import { useModalsState } from './hooks/ui/useModalsState';
import type { RoomData, ObjectData } from './types';
import { createNewRoom } from './utils/factories';
import { IdMapper } from './utils/idMapper';
import { getAllRooms } from './utils/projectObjects';

import { initialProjects } from './data/initialData';

function AuthPages() {
  const [isLogin, setIsLogin] = useState(true);
  return isLogin
    ? <LoginPage onSwitchToRegister={() => setIsLogin(false)} />
    : <RegisterPage onSwitchToLogin={() => setIsLogin(true)} />;
}

function useStoreEffects() {
  useEffect(() => {
    const cleanup = useProjectStore.getState().initSyncListeners();
    return cleanup;
  }, []);
}

function AppContent() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.activeProject);
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);
  const updateProjects = useProjectStore((s) => s.updateProjects);
  const updateActiveProject = useProjectStore((s) => s.updateActiveProject);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const updateRoomById = useProjectStore((s) => s.updateRoomById);
  const deleteRoom = useProjectStore((s) => s.deleteRoom);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const addRoom = useProjectStore((s) => s.addRoom);
  const reorderRooms = useProjectStore((s) => s.reorderRooms);
  const isLoading = useProjectStore((s) => s.isLoading);
  const lastSaved = useProjectStore((s) => s.lastSaved);
  const lastSavedToServer = useProjectStore((s) => s.lastSavedToServer);
  const saveError = useProjectStore((s) => s.saveError);
  const isSyncing = useProjectStore((s) => s.isSyncing);
  const activeObjectId = useProjectStore((s) => s.activeObjectId);
  const activeObject = useProjectStore((s) => s.activeObject);
  const setActiveObjectId = useProjectStore((s) => s.setActiveObjectId);
  const updateObject = useProjectStore((s) => s.updateObject);
  const deleteObject = useProjectStore((s) => s.deleteObject);

  useStoreEffects();

  const { templates, saveTemplate, loadTemplate, deleteTemplate, importTemplates } = useWorkTemplateContext();

  const [activeTab, setActiveTab] = useState<string>('summary');
  const [isLeftMobileMenuOpen, setIsLeftMobileMenuOpen] = useState(false);
  const [isRightMobileMenuOpen, setIsRightMobileMenuOpen] = useState(false);

  const showRoomNameInHeader = useRoomHeaderVisibility(activeTab, activeProject);

  const {
    isTemplatePickerOpen, isCreateObjectModalOpen, isProjectsModalOpen,
    isDataManagementModalOpen, projectToDeleteId,
    openModal, closeModal, setProjectToDeleteId,
  } = useModalsState();

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

  const handleDeleteRoom = (roomId: string) => {
    deleteRoom(roomId);
    const allRooms = activeProject ? getAllRooms(activeProject) : [];
    const remainingRooms = allRooms.filter(r => r.id !== roomId);
    setActiveTab(remainingRooms.length > 1 ? remainingRooms[0]?.id || 'summary' : 'summary');
  };

  const handleAddRoom = () => {
    const newRoom = createNewRoom();
    addRoom(newRoom);
    setActiveTab(newRoom.id);
    setIsLeftMobileMenuOpen(false);
  };

  const handleCopyProject = (id: string) => {
    const sourceProject = projects.find(p => p.id === id);
    if (!sourceProject) return;
    const copiedProject = JSON.parse(JSON.stringify(sourceProject));
    copiedProject.id = `local-${Date.now()}`;
    copiedProject.name = `${sourceProject.name} (копия)`;
    if (copiedProject.objects) {
      copiedProject.objects = copiedProject.objects.map((obj: ObjectData) => ({
        ...obj,
        id: `obj-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        projectId: copiedProject.id,
        rooms: obj.rooms?.map((room: RoomData) => ({
          ...room,
          id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          objectId: obj.id,
        })),
      }));
    }
    updateProjects([...projects, copiedProject]);
    setActiveProjectId(copiedProject.id);
  };

  const handleDeleteProjectConfirm = async () => {
    if (!projectToDeleteId || isSyncing) return;
    if (IdMapper.isServerId(projectToDeleteId)) await deleteProject(projectToDeleteId);
    const updatedProjects = projects.filter(p => p.id !== projectToDeleteId);
    updateProjects(updatedProjects);
    if (projectToDeleteId === activeProjectId && updatedProjects.length > 0) {
      setActiveProjectId(updatedProjects[0].id);
    } else if (updatedProjects.length === 0) {
      setActiveProjectId('');
    }
    setProjectToDeleteId(null);
    setActiveTab('summary');
  };

  const currentRoom = activeProject ? getAllRooms(activeProject).find(r => r.id === activeTab) : undefined;

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col md:flex-row font-sans text-gray-900">
      <LeftSidebar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setIsLeftMobileMenuOpen(false); }}
        onAddRoom={handleAddRoom}
        isMobileMenuOpen={isLeftMobileMenuOpen}
        onMobileMenuClose={() => setIsLeftMobileMenuOpen(false)}
        rooms={activeObject?.rooms || []}
        onReorderRooms={reorderRooms}
        objects={activeProject?.objects || []}
        activeObjectId={activeObjectId}
        activeObject={activeObject}
        onObjectChange={(id) => { setActiveObjectId(id); setActiveTab('summary'); }}
        onAddObject={() => openModal('createObject')}
        city={activeObject?.city || activeProject?.city || ''}
        onCityChange={(city) => {
          if (activeObject) updateObject(activeObject.id, { city: city || undefined });
          else if (activeProject) updateActiveProject({ ...activeProject, city });
        }}
        hasProjects={projects.length > 0}
        onDeleteObject={(id) => {
          if (window.confirm('Удалить объект? Все комнаты в этом объекте будут удалены.')) deleteObject(id);
        }}
      />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AppHeader
          activeTab={activeTab}
          activeProject={activeProject}
          activeObject={activeObject}
          showRoomNameInHeader={showRoomNameInHeader}
          onOpenLeftMobileMenu={() => setIsLeftMobileMenuOpen(true)}
          onOpenRightMobileMenu={() => setIsRightMobileMenuOpen(true)}
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <ContentArea
              projects={projects}
              activeTab={activeTab}
              activeProject={activeProject}
              onCreateProject={() => { openModal('projects'); setIsRightMobileMenuOpen(false); }}
              onTabChange={setActiveTab}
              roomEditorProps={{
                city: activeProject?.city,
                updateRoom,
                updateRoomById,
                onDeleteRoom: currentRoom ? () => handleDeleteRoom(activeTab) : () => {},
                templates,
                onSaveTemplate: saveTemplate,
                onLoadTemplate: loadTemplate,
                onDeleteTemplate: deleteTemplate,
                isTemplatePickerOpen,
                onOpenTemplatePicker: () => openModal('templatePicker'),
                onCloseTemplatePicker: () => closeModal('templatePicker'),
              }}
            />
          </div>
        </div>
      </main>

      <RightSidebar
        isMobileMenuOpen={isRightMobileMenuOpen}
        onMobileMenuClose={() => setIsRightMobileMenuOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        activeProject={activeProject}
        isSyncing={isSyncing}
        onProjectChange={(id) => { setActiveProjectId(id); setActiveTab('summary'); }}
        onRenameProject={(id, name) => updateProjects(projects.map(p => p.id === id ? { ...p, name } : p))}
        onDeleteProject={(id) => setProjectToDeleteId(id)}
        onCopyProject={handleCopyProject}
        onNewProject={() => { openModal('projects'); setIsRightMobileMenuOpen(false); }}
        onDataManagement={() => openModal('dataManagement')}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        objects={activeProject?.objects || []}
        activeObjectId={activeObjectId}
        activeObject={activeObject}
        onObjectChange={(id) => { setActiveObjectId(id); setActiveTab('summary'); }}
        showDeleteConfirm={projectToDeleteId !== null}
        projectToDeleteId={projectToDeleteId}
        onDeleteConfirm={handleDeleteProjectConfirm}
        onDeleteCancel={() => setProjectToDeleteId(null)}
        lastSaved={lastSaved}
        lastSavedToServer={lastSavedToServer}
        saveError={saveError}
      />

      {isCreateObjectModalOpen && <CreateObjectModal onClose={() => closeModal('createObject')} />}
      <ProjectsModal isOpen={isProjectsModalOpen} onClose={() => closeModal('projects')} onImportTemplates={importTemplates} />
      <DataManagementModal isOpen={isDataManagementModalOpen} onClose={() => closeModal('dataManagement')} onImportTemplates={importTemplates} />
    </div>
  );
}

function AppWithAuth() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isTestMode = typeof window !== 'undefined' && localStorage.getItem('e2e-test-mode') === 'true';

  useEffect(() => {
    if (!isLoading) {
      resetStore();
      useProjectStore.getState().initialize(initialProjects, isAuthenticated);
    }
  }, [isLoading, isAuthenticated, user?.id]);

  if (isLoading && !isTestMode) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isTestMode) return <AuthPages />;

  return (
    <WorkTemplateProvider>
      <AppContent />
    </WorkTemplateProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </ErrorBoundary>
  );
}
