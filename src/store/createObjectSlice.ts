import type { StateCreator } from 'zustand';
import type { ObjectSlice, StoreState } from './types';
import type { ObjectData } from '../types';
import {
  getObjectFromProject,
  createNewObject,
  addObjectToProject,
  copyObjectInProject,
  updateObjectInProject,
  deleteObjectFromProject,
  getFirstObject,
} from '../utils/projectObjects';
import {
  logUserAction,
  logSuccess,
  logError,
  logStateChange,
  logWarning,
} from '../utils/logger';

export const createObjectSlice: StateCreator<StoreState, [], [], ObjectSlice> = (set, get) => ({
  activeObjectId: null,
  activeObject: null,

  setActiveObjectId: (id: string | null) => {
    logUserAction('Переключение активного объекта', { objectId: id });
    logStateChange('ProjectContext', 'Активный объект', id);

    set((state) => {
      const activeObject = state.activeProject && id
        ? getObjectFromProject(state.activeProject, id)
        : state.activeProject?.objects?.[0] || null;
      return { activeObjectId: id, activeObject };
    });
  },

  createObject: (data: { name: string; city?: string }): string => {
    const { activeProject } = get();
    if (!activeProject) {
      logError('ProjectContext', 'Cannot create object: no active project');
      return '';
    }

    logUserAction('Создание объекта', { ...data, projectId: activeProject.id });

    const newObject = createNewObject(activeProject.id, data);
    const updatedProject = addObjectToProject(activeProject, newObject);

    get().updateActiveProject(updatedProject);

    set((state) => {
      const activeObject = state.activeProject
        ? getObjectFromProject(state.activeProject, newObject.id)
        : null;
      return { activeObjectId: newObject.id, activeObject };
    });

    logSuccess('ProjectContext', 'Объект создан', { objectId: newObject.id, name: data.name });

    return newObject.id;
  },

  updateObject: (objectId: string, data: Partial<ObjectData>) => {
    const { activeProject } = get();
    if (!activeProject) return;

    logUserAction('Обновление объекта', { objectId, updates: data });

    const updatedProject = updateObjectInProject(activeProject, objectId, data);
    get().updateActiveProject(updatedProject);

    logSuccess('ProjectContext', 'Объект обновлён', { objectId });
  },

  deleteObject: (objectId: string): boolean => {
    const { activeProject, activeObjectId } = get();
    if (!activeProject) return false;

    logUserAction('Удаление объекта', { objectId, projectId: activeProject.id });

    const updatedProject = deleteObjectFromProject(activeProject, objectId);

    if (!updatedProject) {
      logWarning('ProjectContext', 'Невозможно удалить последний объект', { objectId });
      return false;
    }

    get().updateActiveProject(updatedProject);

    if (activeObjectId === objectId) {
      const firstObj = getFirstObject(updatedProject);
      set((state) => {
        const activeObject = state.activeProject && firstObj
          ? getObjectFromProject(state.activeProject, firstObj.id)
          : null;
        return { activeObjectId: firstObj?.id || null, activeObject };
      });
      logStateChange('ProjectContext', 'Активный объект (после удаления)', get().activeObjectId);
    }

    logSuccess('ProjectContext', 'Объект удалён', { objectId });
    return true;
  },

  copyObject: (objectId: string): string | null => {
    const { activeProject } = get();
    if (!activeProject) return null;

    logUserAction('Копирование объекта', { objectId, projectId: activeProject.id });

    const result = copyObjectInProject(activeProject, objectId);

    if (!result) {
      logError('ProjectContext', 'Ошибка копирования объекта', { objectId });
      return null;
    }

    get().updateActiveProject(result.project);

    logSuccess('ProjectContext', 'Объект скопирован', {
      sourceObjectId: objectId,
      newObjectId: result.newObjectId,
    });

    return result.newObjectId;
  },
});
