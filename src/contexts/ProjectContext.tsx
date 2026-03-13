import React, { createContext, useContext, useCallback, useRef, useState, useEffect, type ReactNode } from 'react';
import type { ProjectData, RoomData } from '../types';
import { StorageManager, StorageError } from '../utils/storage';
import { useAuth } from './AuthContext';
import { ApiStorageProvider } from '../api/storage';

// Миграция данных комнаты для обеспечения наличия всех полей
function migrateRoom(room: RoomData): RoomData {
  return {
    ...room,
    segments: room.segments || [],
    obstacles: room.obstacles || [],
    wallSections: room.wallSections || [],
    subSections: room.subSections || [],
    windows: room.windows || [],
    doors: room.doors || [],
    works: room.works || []
  };
}

// Миграция проекта для обеспечения наличия всех полей у комнат
function migrateProject(project: ProjectData): ProjectData {
  return {
    ...project,
    rooms: project.rooms.map(migrateRoom)
  };
}

interface ProjectContextValue {
  // State
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isLoading: boolean;
  error: StorageError | null;
  lastSaved: Date | null;
  saveError: string | null;
  
  // Actions
  setActiveProjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  updateRoom: (room: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  deleteRoom: (roomId: string) => void;
  addRoom: (room: RoomData) => void;
  reorderRooms: (rooms: RoomData[]) => void;
  // Project management
  createProject: (data: { name: string; city?: string }) => Promise<ProjectData>;
  deleteProject: (projectId: string) => Promise<void>;
  isSyncing: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
  initialProjects: ProjectData[];
}

export function ProjectProvider({ children, initialProjects }: ProjectProviderProps) {
  // Получаем состояние авторизации
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Миграция начальных данных
  const migratedInitial = initialProjects.map(migrateProject);
  const [projects, setProjects] = useState<ProjectData[]>(migratedInitial);
  const [activeProjectId, setActiveProjectIdState] = useState<string>(migratedInitial[0]?.id || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<StorageError | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<ProjectData[] | null>(null);
  const apiProviderRef = useRef<ApiStorageProvider | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Вычисляем активный проект
  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  // Получение API провайдера
  const getApiProvider = useCallback((): ApiStorageProvider => {
    if (!apiProviderRef.current) {
      apiProviderRef.current = ApiStorageProvider.getInstance();
    }
    return apiProviderRef.current;
  }, []);

  // Загрузка данных при монтировании или изменении авторизации
  useEffect(() => {
    // Ждем завершения проверки авторизации
    if (authLoading) return;
    
    const loadData = async () => {
      try {
        // Если пользователь авторизован, загружаем с сервера
        if (isAuthenticated) {
          const apiProvider = getApiProvider();
          const serverProjects = await apiProvider.loadProjectsAsync();
          
          if (serverProjects.length > 0) {
            const migratedProjects = serverProjects.map(migrateProject);
            setProjects(migratedProjects);
            
            // Загружаем активный проект из localStorage
            const savedActiveProject = StorageManager.loadActiveProject();
            const activeExists = migratedProjects.some(p => p.id === savedActiveProject);
            
            if (savedActiveProject && activeExists) {
              setActiveProjectIdState(savedActiveProject);
            } else {
              setActiveProjectIdState(migratedProjects[0].id);
            }
          } else {
            // На сервере нет проектов, пробуем загрузить из localStorage и синхронизировать
            const localProjects = StorageManager.loadProjects();
            if (localProjects && localProjects.length > 0) {
              const migratedProjects = localProjects.map(migrateProject);
              setProjects(migratedProjects);
              setActiveProjectIdState(migratedProjects[0].id);
              
              // TODO: Синхронизировать локальные проекты с сервером
            }
          }
        } else {
          // Не авторизован — используем localStorage
          const savedProjects = StorageManager.loadProjects();
          const savedActiveProject = StorageManager.loadActiveProject();

          if (savedProjects && savedProjects.length > 0) {
            const migratedProjects = savedProjects.map(migrateProject);
            setProjects(migratedProjects);

            const activeExists = savedProjects.some(p => p.id === savedActiveProject);
            if (savedActiveProject && activeExists) {
              setActiveProjectIdState(savedActiveProject);
            } else {
              setActiveProjectIdState(savedProjects[0].id);
            }
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError({ type: 'unknown', message: 'Ошибка загрузки данных' });
        setIsLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, authLoading, getApiProvider]);

  // Автосохранение с debounce
  const scheduleSave = useCallback((newProjects: ProjectData[]) => {
    pendingSaveRef.current = newProjects;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingSaveRef.current) {
        try {
          StorageManager.saveProjects(pendingSaveRef.current);
          setLastSaved(new Date());
          setSaveError(null);
          pendingSaveRef.current = null;
        } catch (err) {
          const storageError = err as StorageError;
          setSaveError(storageError.message || 'Ошибка сохранения');
          console.error('Save error:', err);
        }
      }
    }, 1000);
  }, []);

  // Обновление проектов
  const updateProjects = useCallback((newProjects: ProjectData[]) => {
    setProjects(newProjects);
    scheduleSave(newProjects);
  }, [scheduleSave]);

  // Обновление активного проекта
  const updateActiveProject = useCallback((updatedProject: ProjectData) => {
    setProjects(prevProjects => {
      const newProjects = prevProjects.map(p => 
        p.id === updatedProject.id ? updatedProject : p
      );
      scheduleSave(newProjects);
      return newProjects;
    });
  }, [scheduleSave]);

  // Установка активного проекта с сохранением
  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    StorageManager.saveActiveProject(id);
  }, []);

  // Обновление комнаты в активном проекте (прямое значение)
  const updateRoom = useCallback((updatedRoom: RoomData) => {
    setProjects(prevProjects => {
      const prevActiveProject = prevProjects.find(p => p.id === activeProjectId);
      if (!prevActiveProject) {
        return prevProjects;
      }

      const updatedProject = {
        ...prevActiveProject,
        rooms: prevActiveProject.rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r)
      };

      const newProjects = prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p);
      scheduleSave(newProjects);
      return newProjects;
    });
  }, [activeProjectId, scheduleSave]);

  // Обновление комнаты по ID с функцией обновления (для корректной работы при быстрых изменениях)
  const updateRoomById = useCallback((roomId: string, updater: (prev: RoomData) => RoomData) => {
    setProjects(prevProjects => {
      const prevActiveProject = prevProjects.find(p => p.id === activeProjectId);
      if (!prevActiveProject) return prevProjects;
      
      const prevRoom = prevActiveProject.rooms.find(r => r.id === roomId);
      if (!prevRoom) return prevProjects;
      
      const updatedRoom = updater(prevRoom);
      
      const updatedProject = {
        ...prevActiveProject,
        rooms: prevActiveProject.rooms.map(r => r.id === roomId ? updatedRoom : r)
      };
      
      const newProjects = prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p);
      scheduleSave(newProjects);
      return newProjects;
    });
  }, [activeProjectId, scheduleSave]);

  // Удаление комнаты
  const deleteRoom = useCallback((roomId: string) => {
    if (!activeProject) return;
    
    const newRooms = activeProject.rooms.filter(r => r.id !== roomId);
    const updatedProject = {
      ...activeProject,
      rooms: newRooms
    };
    updateActiveProject(updatedProject);
  }, [activeProject, updateActiveProject]);

  // Добавление комнаты
  const addRoom = useCallback((newRoom: RoomData) => {
    if (!activeProject) return;
    
    const updatedProject = {
      ...activeProject,
      rooms: [...activeProject.rooms, newRoom]
    };
    updateActiveProject(updatedProject);
  }, [activeProject, updateActiveProject]);

  // Переупорядочивание комнат
  const reorderRooms = useCallback((newRooms: RoomData[]) => {
    if (!activeProject) return;
    
    const updatedProject = {
      ...activeProject,
      rooms: newRooms
    };
    updateActiveProject(updatedProject);
  }, [activeProject, updateActiveProject]);

  // Создание нового проекта
  const createProject = useCallback(async (data: { name: string; city?: string }): Promise<ProjectData> => {
    setIsSyncing(true);
    
    try {
      if (isAuthenticated) {
        // Создаем на сервере
        const apiProvider = getApiProvider();
        const newProject = await apiProvider.createProjectAsync(data);
        
        setProjects(prev => {
          const updated = [...prev, newProject];
          scheduleSave(updated);
          return updated;
        });
        
        setActiveProjectIdState(newProject.id);
        StorageManager.saveActiveProject(newProject.id);
        
        return newProject;
      } else {
        // Создаем локально
        const newProject: ProjectData = {
          id: `local-${Date.now()}`,
          name: data.name,
          city: data.city,
          rooms: [],
        };
        
        setProjects(prev => {
          const updated = [...prev, newProject];
          scheduleSave(updated);
          return updated;
        });
        
        setActiveProjectIdState(newProject.id);
        StorageManager.saveActiveProject(newProject.id);
        
        return newProject;
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, getApiProvider, scheduleSave]);

  // Удаление проекта
  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    setIsSyncing(true);
    
    try {
      if (isAuthenticated) {
        // Удаляем на сервере
        const apiProvider = getApiProvider();
        await apiProvider.deleteProjectAsync(projectId);
      }
      
      // Удаляем локально
      setProjects(prev => {
        const updated = prev.filter(p => p.id !== projectId);
        scheduleSave(updated);
        return updated;
      });
      
      // Если удалили активный проект, переключаемся на первый доступный
      if (activeProjectId === projectId) {
        const remaining = projects.filter(p => p.id !== projectId);
        if (remaining.length > 0) {
          setActiveProjectIdState(remaining[0].id);
          StorageManager.saveActiveProject(remaining[0].id);
        } else {
          setActiveProjectIdState('');
          localStorage.removeItem('repair-calc-active-project');
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, getApiProvider, scheduleSave, activeProjectId, projects]);

  // Сохранение перед закрытием страницы
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSaveRef.current) {
        StorageManager.saveProjects(pendingSaveRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const value: ProjectContextValue = {
    projects,
    activeProjectId,
    activeProject,
    isLoading,
    error,
    lastSaved,
    saveError,
    setActiveProjectId,
    updateProjects,
    updateActiveProject,
    updateRoom,
    updateRoomById,
    deleteRoom,
    addRoom,
    reorderRooms,
    createProject,
    deleteProject,
    isSyncing,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

/**
 * Хук для доступа к контексту проекта.
 * Выбрасывает ошибку, если используется вне ProjectProvider.
 */
export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}

/**
 * Хук для доступа к конкретной комнате по ID.
 * Возвращает null, если комната не найдена.
 */
export function useRoom(roomId: string | null): RoomData | null {
  const { activeProject } = useProjectContext();
  
  if (!roomId || !activeProject) return null;
  
  return activeProject.rooms.find(r => r.id === roomId) || null;
}

export { ProjectContext };