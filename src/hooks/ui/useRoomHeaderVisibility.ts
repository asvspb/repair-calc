import { useState, useEffect } from 'react';
import type { ProjectData } from '../../types';

export function useRoomHeaderVisibility(
  activeTab: string,
  activeProject: ProjectData | undefined
): boolean {
  const [showRoomNameInHeader, setShowRoomNameInHeader] = useState(false);

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

  return showRoomNameInHeader;
}
