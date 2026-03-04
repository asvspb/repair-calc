import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProjectData, RoomData } from '../App';
import { StorageManager, StorageError } from '../utils/storage';

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

interface UseProjectsReturn {
  projects: ProjectData[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  isLoading: boolean;
  error: StorageError | null;
  lastSaved: Date | null;
  saveError: string | null;
}

export function useProjects(initialProjects: ProjectData[]): UseProjectsReturn {
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

  // Загрузка данных при монтировании
  useEffect(() => {
    const loadData = () => {
      try {
        const savedProjects = StorageManager.loadProjects();
        const savedActiveProject = StorageManager.loadActiveProject();

        if (savedProjects && savedProjects.length > 0) {
          // Миграция данных для обеспечения наличия всех полей
          const migratedProjects = savedProjects.map(migrateProject);
          setProjects(migratedProjects);

          // Проверяем, существует ли сохраненный активный проект
          const activeExists = savedProjects.some(p => p.id === savedActiveProject);
          if (savedActiveProject && activeExists) {
            setActiveProjectIdState(savedActiveProject);
          } else {
            setActiveProjectIdState(savedProjects[0].id);
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
  }, []);

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
    }, 1000); // Сохраняем через 1 секунду после последнего изменения
  }, []);

  // Обновление проектов
  const updateProjects = useCallback((newProjects: ProjectData[]) => {
    setProjects(newProjects);
    scheduleSave(newProjects);
  }, [scheduleSave]);

  // Обновление активного проекта
  // Используем функциональное обновление чтобы избежать stale closure
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

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    updateProjects,
    updateActiveProject,
    isLoading,
    error,
    lastSaved,
    saveError
  };
}
