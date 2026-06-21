import { Trash2 } from 'lucide-react';
import type { RoomData } from '@shared/types';

interface RoomHeaderProps {
  room: RoomData;
  onUpdateRoom: (room: RoomData) => void;
  onDelete: () => void;
}

export function RoomHeader({ room, onUpdateRoom, onDelete }: RoomHeaderProps) {
  return (
    <div
      id="room-header-title"
      className="group flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
    >
      <input
        data-testid="room-header-title"
        className="text-2xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full max-w-md"
        value={room.name}
        onChange={e => onUpdateRoom({ ...room, name: e.target.value })}
      />
      <button
        onClick={onDelete}
        data-testid="delete-room-btn"
        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        title="Удалить комнату"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}
