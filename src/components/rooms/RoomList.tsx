import React from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { RoomListItem } from './RoomListItem';
import type { RoomData } from '../../App';

type RoomListProps = {
  rooms: RoomData[];
  activeTab: string;
  onRoomClick: (roomId: string) => void;
  onReorderRooms: (rooms: RoomData[]) => void;
};

export const RoomList: React.FC<RoomListProps> = ({
  rooms,
  activeTab,
  onRoomClick,
  onReorderRooms,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = rooms.findIndex((r) => r.id === active.id);
      const newIndex = rooms.findIndex((r) => r.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newRooms = arrayMove(rooms, oldIndex, newIndex);
        onReorderRooms(newRooms);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={rooms.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div>
          {rooms.map((room) => (
            <RoomListItem
              key={room.id}
              room={room}
              isActive={activeTab === room.id}
              onClick={() => onRoomClick(room.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
