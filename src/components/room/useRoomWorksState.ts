import type { WorkData, Material, Tool, RoomData } from '@shared/types';
import { createNewMaterial, createNewTool } from '../../domain/factories/projectFactory';

export function useRoomWorksState(
  room: RoomData,
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void,
) {
  const handleWorkChange = (
    id: string,
    field: keyof WorkData,
    value: string | number | boolean,
  ) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      works: (prev.works || []).map(w => (w.id === id ? { ...w, [field]: value } : w)),
    }));
  };

  const handleMaterialChange = (
    workId: string,
    materialId: string,
    field: keyof Material,
    value: string | number,
  ) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      works: (prev.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: (w.materials || []).map(m =>
            m.id === materialId ? { ...m, [field]: value } : m,
          ),
        };
      }),
    }));
  };

  const addMaterial = (workId: string) => {
    const work = (room.works || []).find(w => w.id === workId);
    const newMaterial = createNewMaterial(work?.unit || 'м²');
    updateRoomById(room.id, prev => ({
      ...prev,
      works: (prev.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: [...(w.materials || []), newMaterial],
        };
      }),
    }));
  };

  const removeMaterial = (workId: string, materialId: string) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      works: (prev.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          materials: (w.materials || []).filter(m => m.id !== materialId),
        };
      }),
    }));
  };

  const handleToolChange = (
    workId: string,
    toolId: string,
    field: keyof Tool,
    value: string | number | boolean,
  ) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      works: (prev.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: (w.tools || []).map(t => (t.id === toolId ? { ...t, [field]: value } : t)),
        };
      }),
    }));
  };

  const addTool = (workId: string) => {
    const newTool = createNewTool();
    updateRoomById(room.id, prev => ({
      ...prev,
      works: (prev.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: [...(w.tools || []), newTool],
        };
      }),
    }));
  };

  const removeTool = (workId: string, toolId: string) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      works: (prev.works || []).map(w => {
        if (w.id !== workId) return w;
        return {
          ...w,
          tools: (w.tools || []).filter(t => t.id !== toolId),
        };
      }),
    }));
  };

  const addCustomWork = () => {
    const newWork: WorkData = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Работа',
      unit: 'м²',
      enabled: true,
      workUnitPrice: 0,
      materialPriceType: 'total',
      materialPrice: 0,
      materials: [],
      tools: [],
      calculationType: 'floorArea',
      isCustom: true,
    };
    updateRoomById(room.id, prev => ({
      ...prev,
      works: [...(prev.works || []), newWork],
    }));
  };

  const removeWork = (id: string) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      works: (prev.works || []).filter(w => w.id !== id),
    }));
  };

  const reorderWorks = (newWorks: WorkData[]) => {
    updateRoomById(room.id, prev => ({
      ...prev,
      works: newWorks,
    }));
  };

  return {
    handleWorkChange,
    handleMaterialChange,
    addMaterial,
    removeMaterial,
    handleToolChange,
    addTool,
    removeTool,
    addCustomWork,
    removeWork,
    reorderWorks,
  };
}
