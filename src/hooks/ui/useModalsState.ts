import { useState, useCallback } from 'react';

export type ModalName = 'templatePicker' | 'createObject' | 'projects' | 'dataManagement';

interface ModalsState {
  isTemplatePickerOpen: boolean;
  isCreateObjectModalOpen: boolean;
  isProjectsModalOpen: boolean;
  isDataManagementModalOpen: boolean;
  projectToDeleteId: string | null;
}

interface ModalsActions {
  openModal: (name: ModalName) => void;
  closeModal: (name: ModalName) => void;
  setProjectToDeleteId: (id: string | null) => void;
}

export type UseModalsStateReturn = ModalsState & ModalsActions;

export function useModalsState(): UseModalsStateReturn {
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isCreateObjectModalOpen, setIsCreateObjectModalOpen] = useState(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isDataManagementModalOpen, setIsDataManagementModalOpen] = useState(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);

  const openModal = useCallback((name: ModalName) => {
    switch (name) {
      case 'templatePicker':
        setIsTemplatePickerOpen(true);
        break;
      case 'createObject':
        setIsCreateObjectModalOpen(true);
        break;
      case 'projects':
        setIsProjectsModalOpen(true);
        break;
      case 'dataManagement':
        setIsDataManagementModalOpen(true);
        break;
    }
  }, []);

  const closeModal = useCallback((name: ModalName) => {
    switch (name) {
      case 'templatePicker':
        setIsTemplatePickerOpen(false);
        break;
      case 'createObject':
        setIsCreateObjectModalOpen(false);
        break;
      case 'projects':
        setIsProjectsModalOpen(false);
        break;
      case 'dataManagement':
        setIsDataManagementModalOpen(false);
        break;
    }
  }, []);

  return {
    isTemplatePickerOpen,
    isCreateObjectModalOpen,
    isProjectsModalOpen,
    isDataManagementModalOpen,
    projectToDeleteId,
    openModal,
    closeModal,
    setProjectToDeleteId,
  };
}
