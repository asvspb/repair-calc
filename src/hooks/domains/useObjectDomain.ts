import { useState, useCallback } from 'react';
import type { ObjectData, ProjectData } from '../../types';
import {
  getObjectFromProject,
  createNewObject,
  addObjectToProject,
  copyObjectInProject,
  updateObjectInProject,
  deleteObjectFromProject,
  getFirstObject,
} from '../../utils/projectObjects';
import {
  logUserAction,
  logSuccess,
  logError,
  logStateChange,
  logWarning,
} from '../../utils/logger';

export interface ObjectDomainState {
  activeObjectId: string | null;
  activeObject: ObjectData | null;
  setActiveObjectId: (id: string | null) => void;
  createObject: (data: { name: string; city?: string }) => string;
  updateObject: (objectId: string, data: Partial<ObjectData>) => void;
  deleteObject: (objectId: string) => boolean;
  copyObject: (objectId: string) => string | null;
}

interface ObjectDomainDeps {
  activeProject: ProjectData | null;
  updateActiveProject: (project: ProjectData) => void;
}

export function useObjectDomain({ activeProject, updateActiveProject }: ObjectDomainDeps): ObjectDomainState {
  const [activeObjectId, setActiveObjectIdState] = useState<string | null>(null);

  const activeObject = activeProject && activeObjectId
    ? getObjectFromProject(activeProject, activeObjectId)
    : activeProject?.objects?.[0] || null;

  const setActiveObjectId = useCallback((id: string | null) => {
    logUserAction('Переключение активного объекта', { objectId: id });
    setActiveObjectIdState(id);
    logStateChange('ProjectContext', 'Активный объект', id);
  }, []);

  const createObject = useCallback((data: { name: string; city?: string }): string => {
    if (!activeProject) {
      logError('ProjectContext', 'Cannot create object: no active project');
      return '';
    }

    logUserAction('Создание объекта', { ...data, projectId: activeProject.id });

    const newObject = createNewObject(activeProject.id, data);
    const updatedProject = addObjectToProject(activeProject, newObject);

    updateActiveProject(updatedProject);
    setActiveObjectIdState(newObject.id);

    logSuccess('ProjectContext', 'Объект создан', { objectId: newObject.id, name: data.name });

    return newObject.id;
  }, [activeProject, updateActiveProject]);

  const updateObject = useCallback((objectId: string, data: Partial<ObjectData>) => {
    if (!activeProject) return;

    logUserAction('Обновление объекта', { objectId, updates: data });

    const updatedProject = updateObjectInProject(activeProject, objectId, data);
    updateActiveProject(updatedProject);

    logSuccess('ProjectContext', 'Объект обновлён', { objectId });
  }, [activeProject, updateActiveProject]);

  const deleteObject = useCallback((objectId: string): boolean => {
    if (!activeProject) return false;

    logUserAction('Удаление объекта', { objectId, projectId: activeProject.id });

    const updatedProject = deleteObjectFromProject(activeProject, objectId);

    if (!updatedProject) {
      logWarning('ProjectContext', 'Невозможно удалить последний объект', { objectId });
      return false;
    }

    updateActiveProject(updatedProject);

    if (activeObjectId === objectId) {
      const firstObj = getFirstObject(updatedProject);
      setActiveObjectIdState(firstObj?.id || null);
      logStateChange('ProjectContext', 'Активный объект (после удаления)', firstObj?.id || null);
    }

    logSuccess('ProjectContext', 'Объект удалён', { objectId });
    return true;
  }, [activeProject, activeObjectId, updateActiveProject]);

  const copyObject = useCallback((objectId: string): string | null => {
    if (!activeProject) return null;

    logUserAction('Копирование объекта', { objectId, projectId: activeProject.id });

    const result = copyObjectInProject(activeProject, objectId);

    if (!result) {
      logError('ProjectContext', 'Ошибка копирования объекта', { objectId });
      return null;
    }

    updateActiveProject(result.project);

    logSuccess('ProjectContext', 'Объект скопирован', {
      sourceObjectId: objectId,
      newObjectId: result.newObjectId,
    });

    return result.newObjectId;
  }, [activeProject, updateActiveProject]);

  return {
    activeObjectId,
    activeObject,
    setActiveObjectId,
    createObject,
    updateObject,
    deleteObject,
    copyObject,
  };
}
