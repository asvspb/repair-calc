import React from 'react';
import type { GeometryMode } from '../../types';

interface ModeSelectorProps {
  currentMode: GeometryMode;
  onModeChange: (mode: GeometryMode) => void;
}

export function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  const modes: { value: GeometryMode; label: string }[] = [
    { value: 'simple', label: 'Простой' },
    { value: 'extended', label: 'Расширенный' },
    { value: 'advanced', label: 'Профессиональный' },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {modes.map(mode => (
        <button
          key={mode.value}
          onClick={() => onModeChange(mode.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            currentMode === mode.value
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
