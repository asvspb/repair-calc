import { useState, useCallback, useRef, useEffect } from 'react';
import type { ProjectData, ObjectData } from '../../types';
import { StorageManager } from '../../utils/storage';
import type { StorageError } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { ApiStorageProvider } from '../../api/storage';
import { saveTotals } from '../../api/totals';
import { calculateRoomMetrics } from '../../utils/geometry';
import { calculateRoomCosts } from '../../utils/costs';
import {
  logUserAction,
  logSuccess,
  logError,
  logStart,
  logEnd,
  logStateChange,
  logWarning,
  logDebug,
} from '../../utils/logger';
import { runMigrations, needsMigration } from '../../utils/migration';
import { idMapper, IdMapper, isServerId } from '../../utils/idMapper';
import { saveQueue } from '../../utils/saveQueue';
import { getAllRooms, migrateProjectToObjects } from '../../utils/projectObjects';

const SAVE_DEBOUNCE_MS = 2000;
const TOTALS_SAVE_DEBOUNCE_MS = 2000;

function migrateRoom(room: import('../../types').RoomData): import('../../types').RoomData {
  const migrated = {
    ...room,
    length: room.length ?? 0,
    width: room.width ?? 0,
    height: room.height ?? 0,
    segments: room.segments || [],
    obstacles: room.obstacles || [],
    wallSections: room.wallSections || [],
    subSections: room.subSections || [],
    windows: room.windows || [],
    doors: room.doors || [],
    works: room.works || [],
  };

  if (import.meta.env.DEV) {
    const numericFields = ['length', 'width', 'height'] as const;
    for (const field of numericFields) {
      if (typeof migrated[field] !== 'number') {
        logWarning('migrateRoom', `Field "${field}" should be number after migration`);
      }
    }
  }

  return migrated;
}

export function migrateProject(project: ProjectData): ProjectData {
  const roomsWithDefaults = (project.rooms || []).map(migrateRoom);
  const projectWithObjects = {
    ...project,
    rooms: roomsWithDefaults.length > 0 ? roomsWithDefaults : undefined,
  };
  return migrateProjectToObjects(projectWithObjects);
}

export interface ProjectDomainState {
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isLoading: boolean;
  error: StorageError | null;
  lastSaved: Date | null;
  saveError: string | null;
  lastSavedToServer: Date | null;
  lastTotalsSave: Date | null;
  totalsSaveError: string | null;
  roomSyncError: string | null;
  isSyncing: boolean;
  isAuthenticated: boolean;
  setActiveProjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  createProject: (data: { name: string; city?: string; objects?: string[] }) => Promise<ProjectData>;
  deleteProject: (projectId: string) => Promise<void>;
  scheduleSave: (newProjects: ProjectData[]) => void;
  scheduleTotalsSave: (project: ProjectData) => void;
  setProjects: React.Dispatch<React.SetStateAction<ProjectData[]>>;
}

export function useProjectDomain(initialProjects: ProjectData[]): ProjectDomainState {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const migratedInitial = initialProjects.map(migrateProject);
  const [projects, setProjects] = useState<ProjectData[]>(migratedInitial);
  const [activeProjectId, setActiveProjectIdState] = useState<string>(migratedInitial[0]?.id || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<StorageError | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedToServer, setLastSavedToServer] = useState<Date | null>(null);
  const [lastTotalsSave, setLastTotalsSave] = useState<Date | null>(null);
  const [totalsSaveError, setTotalsSaveError] = useState<string | null>(null);
  const [roomSyncError, setRoomSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<ProjectData[] | null>(null);
  const totalsSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  const getApiProvider = useCallback((): ApiStorageProvider => {
    return ApiStorageProvider.getInstance();
  }, []);

  const saveCalculatedTotals = useCallback(async (project: ProjectData) => {
    if (!isAuthenticated) return;
    if (!isServerId(project.id)) return;

    let totalArea = 0;
    let totalWorks = 0;
    let totalMaterials = 0;
    let totalTools = 0;

    const allRooms = getAllRooms(project);
    allRooms.forEach(room => {
      const metrics = calculateRoomMetrics(room);
      const costs = calculateRoomCosts(room);
      totalArea += metrics.floorArea;
      totalWorks += costs.totalWork;
      totalMaterials += costs.totalMaterial;
      totalTools += costs.totalTools;
    });

    const grandTotal = totalWorks + totalMaterials + totalTools;

    try {
      await saveTotals(project.id, {
        total_area: totalArea,
        total_works: totalWorks,
        total_materials: totalMaterials,
        total_tools: totalTools,
        grand_total: grandTotal,
      });
      setLastTotalsSave(new Date());
      setTotalsSaveError(null);
    } catch (err) {
      logError('ProjectContext', 'Ошибка сохранения расчётов', err);
      setTotalsSaveError(err instanceof Error ? err.message : 'Ошибка сохранения расчётов');
    }
  }, [isAuthenticated]);

  const scheduleTotalsSave = useCallback((project: ProjectData) => {
    if (totalsSaveTimeoutRef.current) {
      clearTimeout(totalsSaveTimeoutRef.current);
    }
    totalsSaveTimeoutRef.current = setTimeout(() => {
      saveCalculatedTotals(project);
    }, TOTALS_SAVE_DEBOUNCE_MS);
  }, [saveCalculatedTotals]);

  const scheduleSave = useCallback((newProjects: ProjectData[]) => {
    pendingSaveRef.current = newProjects;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (pendingSaveRef.current) {
        const startTime = logStart('Save', 'Автосохранение проектов');
        const projectsToSave = pendingSaveRef.current;

        const saveTask = async () => {
          try {
            const changedProjects = projectsToSave.filter(newProj => {
              const oldProj = projects.find(p => p.id === newProj.id);
              if (!oldProj) return true;
              return JSON.stringify(oldProj) !== JSON.stringify(newProj);
            });

            if (changedProjects.length === 1 && projectsToSave.length > 1) {
              const changedProject = changedProjects[0];
              logSuccess('Save', 'Инкрементальное сохранение одного проекта', {
                projectId: changedProject.id,
                name: changedProject.name,
              });

              StorageManager.saveProject(changedProject);
              setLastSaved(new Date());
              logSuccess('Save', 'Сохранено в localStorage (инкрементально)', {
                projectId: changedProject.id,
              }, startTime);

              if (isAuthenticated) {
                const apiProvider = getApiProvider();
                const serverStartTime = logStart('Save', 'Сохранение проекта на сервер');
                await apiProvider.saveProjectAsync(changedProject);
                setLastSavedToServer(new Date());
                logSuccess('Save', 'Проект сохранен на сервере (инкрементально)', {
                  projectId: changedProject.id,
                }, serverStartTime);
                setSaveError(null);
              }
            } else {
              StorageManager.saveProjects(projectsToSave);
              setLastSaved(new Date());
              logSuccess('Save', 'Сохранено в localStorage', {
                count: projectsToSave.length,
                projectIds: projectsToSave.map(p => p.id),
              }, startTime);

              if (isAuthenticated) {
                const apiProvider = getApiProvider();
                const serverStartTime = logStart('Save', 'Сохранение на сервер');
                await apiProvider.saveProjectsAsync(projectsToSave);
                setLastSavedToServer(new Date());
                logSuccess('Save', 'Сохранено на сервер', {
                  count: projectsToSave.length,
                }, serverStartTime);
                setSaveError(null);
              }
            }
            pendingSaveRef.current = null;
          } catch (err) {
            const storageError = err as StorageError;
            setSaveError(storageError.message || 'Ошибка сохранения');
            logError('Save', 'Ошибка сохранения', err);
            throw err;
          }
        };

        saveQueue.enqueue(saveTask, projectsToSave);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [isAuthenticated, getApiProvider, projects]);

  const updateProjects = useCallback((newProjects: ProjectData[]) => {
    setProjects(newProjects);
    scheduleSave(newProjects);
    const active = newProjects.find(p => p.id === activeProjectId);
    if (active && isAuthenticated) {
      scheduleTotalsSave(active);
    }
  }, [scheduleSave, activeProjectId, isAuthenticated, scheduleTotalsSave]);

  const updateActiveProject = useCallback((updatedProject: ProjectData) => {
    setProjects(prevProjects => {
      const newProjects = prevProjects.map(p =>
        p.id === updatedProject.id ? updatedProject : p
      );
      scheduleSave(newProjects);
      if (isAuthenticated) {
        scheduleTotalsSave(updatedProject);
      }
      return newProjects;
    });
  }, [scheduleSave, isAuthenticated, scheduleTotalsSave]);

  const setActiveProjectId = useCallback((id: string) => {
    logUserAction('Переключение активного проекта', { projectId: id });
    setActiveProjectIdState(id);
    StorageManager.saveActiveProject(id);
    logStateChange('ProjectContext', 'Активный проект', id);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const loadData = async () => {
      const startTime = logStart('ProjectContext', 'Загрузка данных', { isAuthenticated });

      try {
        if (isAuthenticated) {
          logUserAction('Загрузка проектов с сервера (авторизован)');
          const apiProvider = getApiProvider();
          let serverProjects = await apiProvider.loadProjectsAsync();

          if (needsMigration()) {
            logDebug('ProjectContext', 'Требуется миграция данных');
            try {
              const migrationResult = await runMigrations(serverProjects);
              if (migrationResult.duplicatesRemoved > 0) {
                logSuccess('ProjectContext', 'Миграция выполнена', migrationResult);
                serverProjects = await apiProvider.loadProjectsAsync();
              }
            } catch (migrationError) {
              logError('ProjectContext', 'Ошибка миграции', migrationError);
            }
          }

          if (serverProjects.length > 0) {
            const migratedProjects = serverProjects.map(migrateProject);
            logSuccess('ProjectContext', 'Проекты загружены с сервера', {
              count: migratedProjects.length,
              projectIds: migratedProjects.map(p => p.id),
            }, startTime);
            setProjects(migratedProjects);

            const savedActiveProject = StorageManager.loadActiveProject();
            let actualActiveId = savedActiveProject;
            if (savedActiveProject && IdMapper.isLocalId(savedActiveProject)) {
              const mappedId = idMapper.getServerId(savedActiveProject);
              if (mappedId) {
                actualActiveId = mappedId;
                StorageManager.saveActiveProject(mappedId);
                logDebug('ProjectContext', 'Активный проект мигрирован', {
                  oldId: savedActiveProject,
                  newId: mappedId,
                });
              }
            }

            const activeExists = migratedProjects.some(p => p.id === actualActiveId);
            if (actualActiveId && activeExists) {
              setActiveProjectIdState(actualActiveId);
              logStateChange('ProjectContext', 'Активный проект', actualActiveId);
            } else {
              setActiveProjectIdState(migratedProjects[0].id);
              logStateChange('ProjectContext', 'Активный проект', migratedProjects[0].id);
            }
          } else {
            logWarning('ProjectContext', 'На сервере нет проектов, проверяем localStorage');
            const localProjects = StorageManager.loadProjects();
            if (localProjects && localProjects.length > 0) {
              const migratedProjects = localProjects.map(migrateProject);
              logSuccess('ProjectContext', 'Проекты загружены из localStorage', {
                count: migratedProjects.length,
              }, startTime);
              setProjects(migratedProjects);
              setActiveProjectIdState(migratedProjects[0].id);
            }
          }
        } else {
          logUserAction('Загрузка проектов из localStorage (не авторизован)');
          const savedProjects = StorageManager.loadProjects();
          const savedActiveProject = StorageManager.loadActiveProject();

          if (savedProjects && savedProjects.length > 0) {
            const migratedProjects = savedProjects.map(migrateProject);
            logSuccess('ProjectContext', 'Проекты загружены из localStorage', {
              count: migratedProjects.length,
              projectIds: migratedProjects.map(p => p.id),
            }, startTime);
            setProjects(migratedProjects);

            const activeExists = savedProjects.some(p => p.id === savedActiveProject);
            if (savedActiveProject && activeExists) {
              setActiveProjectIdState(savedActiveProject);
              logStateChange('ProjectContext', 'Активный проект', savedActiveProject);
            } else {
              setActiveProjectIdState(savedProjects[0].id);
              logStateChange('ProjectContext', 'Активный проект', savedProjects[0].id);
            }
          } else {
            logSuccess('ProjectContext', 'Первый запуск - используются демонстрационные проекты', {
              count: migratedInitial.length,
              projectIds: migratedInitial.map(p => p.id),
            }, startTime);

            if (migratedInitial.length > 0) {
              StorageManager.saveProjects(migratedInitial);
              StorageManager.saveActiveProject(migratedInitial[0].id);
              setProjects(migratedInitial);
              setActiveProjectIdState(migratedInitial[0].id);
              logStateChange('ProjectContext', 'Активный проект', migratedInitial[0].id);
            } else {
              setProjects([]);
              setActiveProjectIdState('');
              logStateChange('ProjectContext', 'Активный проект', null);
            }
          }
        }

        setIsLoading(false);
        logEnd('ProjectContext', 'Загрузка данных завершена', startTime);
      } catch (err) {
        logError('ProjectContext', 'Ошибка загрузки данных', err);
        setError({ type: 'unknown', message: 'Ошибка загрузки данных' });
        setIsLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, authLoading, getApiProvider]);

  const createProject = useCallback(async (data: { name: string; city?: string; objects?: string[] }): Promise<ProjectData> => {
    logUserAction('Создание проекта', data);
    setIsSyncing(true);
    const startTime = logStart('ProjectContext', 'Создание проекта', data);

    const generateId = (prefix: string): string =>
      `${prefix}-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 10)}`;

    try {
      if (isAuthenticated) {
        logDebug('ProjectContext', 'Создание проекта на сервере', data);
        const apiProvider = getApiProvider();
        const newProject = await apiProvider.createProjectAsync(data);

        if (data.objects && data.objects.length > 0) {
          const objects: ObjectData[] = data.objects.map((objName, index) => ({
            id: generateId('obj'),
            projectId: newProject.id,
            name: objName,
            city: data.city,
            rooms: [],
            sortOrder: index,
          }));
          newProject.objects = objects;
          await apiProvider.saveProjectsAsync([newProject]);
        }

        logSuccess('ProjectContext', 'Проект создан на сервере', {
          id: newProject.id,
          name: newProject.name,
          objectsCount: newProject.objects?.length || 0,
        }, startTime);

        setProjects(prev => {
          const updated = [...prev, newProject];
          scheduleSave(updated);
          return updated;
        });

        setActiveProjectIdState(newProject.id);
        StorageManager.saveActiveProject(newProject.id);
        logStateChange('ProjectContext', 'Активный проект', newProject.id);

        return newProject;
      } else {
        logDebug('ProjectContext', 'Создание локального проекта', data);

        const objects: ObjectData[] = (data.objects || ['Основной объект']).map((objName, index) => ({
          id: generateId('obj'),
          projectId: generateId('local'),
          name: objName,
          city: data.city,
          rooms: [],
          sortOrder: index,
        }));

        const newProject: ProjectData = {
          id: generateId('local'),
          name: data.name,
          city: data.city,
          objects: objects,
        };

        logSuccess('ProjectContext', 'Локальный проект создан', {
          id: newProject.id,
          name: newProject.name,
          objectsCount: objects.length,
        }, startTime);

        setProjects(prev => {
          const updated = [...prev, newProject];
          scheduleSave(updated);
          return updated;
        });

        setActiveProjectIdState(newProject.id);
        StorageManager.saveActiveProject(newProject.id);
        logStateChange('ProjectContext', 'Активный проект', newProject.id);

        return newProject;
      }
    } catch (err) {
      logError('ProjectContext', 'Ошибка создания проекта', err, data);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, getApiProvider, scheduleSave]);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    logUserAction('Удаление проекта', { projectId });
    setIsSyncing(true);
    const startTime = logStart('ProjectContext', 'Удаление проекта', { projectId });

    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      pendingSaveRef.current = null;

      if (isAuthenticated) {
        const apiProvider = ApiStorageProvider.getInstance();
        apiProvider.markProjectDeleted(projectId);

        logDebug('ProjectContext', 'Удаление проекта на сервере', { projectId });
        try {
          await apiProvider.deleteProjectAsync(projectId);
          logSuccess('ProjectContext', 'Проект удалён с сервера', { projectId }, startTime);
        } catch (serverError) {
          logError('ProjectContext', 'Ошибка удаления на сервере, удаляем локально', serverError, { projectId });
          setSaveError('Не удалось удалить проект на сервере. Проект удалён локально.');
          setTimeout(() => setSaveError(null), 5000);
        }
      }

      setProjects(prev => {
        const updated = prev.filter(p => p.id !== projectId);
        scheduleSave(updated);
        return updated;
      });

      if (activeProjectId === projectId) {
        const remaining = projects.filter(p => p.id !== projectId);
        if (remaining.length > 0) {
          setActiveProjectIdState(remaining[0].id);
          StorageManager.saveActiveProject(remaining[0].id);
          logStateChange('ProjectContext', 'Активный проект (после удаления)', remaining[0].id);
        } else {
          setActiveProjectIdState('');
          localStorage.removeItem('repair-calc-active-project');
          logStateChange('ProjectContext', 'Активный проект (после удаления)', null);
        }
      }

      logEnd('ProjectContext', 'Удаление проекта завершено', startTime);
    } catch (err) {
      logError('ProjectContext', 'Критическая ошибка удаления проекта', err, { projectId });
      setSaveError('Ошибка при удалении проекта');
      setTimeout(() => setSaveError(null), 5000);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, scheduleSave, activeProjectId, projects]);

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
      if (totalsSaveTimeoutRef.current) {
        clearTimeout(totalsSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (saveQueue.hasPendingData && isAuthenticated) {
      const pendingData = saveQueue.getPendingData();
      if (pendingData && Array.isArray(pendingData)) {
        logDebug('ProjectContext', 'Восстановление pending сохранений', {
          count: pendingData.length,
        });
        pendingSaveRef.current = pendingData as ProjectData[];
        scheduleSave(pendingSaveRef.current);
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && saveQueue.hasPendingData) {
        logDebug('ProjectContext', 'Вкладка активна, проверяем pending сохранения');
        const pendingData = saveQueue.getPendingData();
        if (pendingData && Array.isArray(pendingData) && !pendingSaveRef.current) {
          pendingSaveRef.current = pendingData as ProjectData[];
          scheduleSave(pendingSaveRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, scheduleSave]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkRoomSyncErrors = () => {
      const apiProvider = getApiProvider();
      const errors = apiProvider.getRoomSyncErrors();

      if (errors.size > 0) {
        const errorMessages = Array.from(errors.entries()).map(([key, value]) => {
          const roomId = key.split(':')[1];
          return `Комната ${roomId}: ${value.error.message}`;
        });
        setRoomSyncError(`Ошибка синхронизации комнат: ${errorMessages.join('; ')}`);
      } else {
        setRoomSyncError(null);
      }
    };

    checkRoomSyncErrors();
    const interval = setInterval(checkRoomSyncErrors, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, getApiProvider]);

  return {
    projects,
    activeProjectId,
    activeProject,
    isLoading,
    error,
    lastSaved,
    saveError,
    lastSavedToServer,
    lastTotalsSave,
    totalsSaveError,
    roomSyncError,
    isSyncing,
    isAuthenticated,
    setActiveProjectId,
    updateProjects,
    updateActiveProject,
    createProject,
    deleteProject,
    scheduleSave,
    scheduleTotalsSave,
    setProjects,
  };
}
