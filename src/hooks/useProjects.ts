import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProjectData } from '../App';
import { StorageManager, StorageError } from '../utils/storage';

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
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects);
  const [activeProjectId, setActiveProjectIdState] = useState<string>(initialProjects[0]?.id || '');
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
          setProjects(savedProjects);
          
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
  const updateActiveProject = useCallback((updatedProject: ProjectData) => {
    const newProjects = projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    );
    setProjects(newProjects);
    scheduleSave(newProjects);
  }, [projects, scheduleSave]);

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
