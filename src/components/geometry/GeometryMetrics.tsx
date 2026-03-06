import React from 'react';
import { Ruler, Square, Box } from 'lucide-react';

interface GeometryMetricsProps {
  area: number;
  perimeter: number;
  height?: number;
  showVolume?: boolean;
  showSkirting?: boolean;
  doorsWidth?: number;
  className?: string;
}

export function GeometryMetrics({
  area,
  perimeter,
  height = 0,
  showVolume = false,
  showSkirting = false,
  doorsWidth = 0,
  className = '',
}: GeometryMetricsProps) {
  const volume = showVolume ? area * height : 0;
  const skirtingLength = showSkirting ? Math.max(0, perimeter - doorsWidth) : 0;

  return (
    <div className={`flex flex-wrap gap-4 text-xs text-gray-500 ${className}`}>
      <div className="flex items-center gap-1.5">
        <Square className="w-3.5 h-3.5 text-indigo-500" />
        <span className="font-medium">{area.toFixed(1)} м²</span>
        <span className="text-gray-400">площадь</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Ruler className="w-3.5 h-3.5 text-indigo-500" />
        <span className="font-medium">{perimeter.toFixed(1)} м</span>
        <span className="text-gray-400">периметр</span>
      </div>
      {showVolume && height > 0 && (
        <div className="flex items-center gap-1.5">
          <Box className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-medium">{volume.toFixed(1)} м³</span>
          <span className="text-gray-400">объем</span>
        </div>
      )}
      {showSkirting && (
        <div className="flex items-center gap-1.5">
          <Ruler className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-medium">{skirtingLength.toFixed(1)} м</span>
          <span className="text-gray-400">плинтус</span>
        </div>
      )}
    </div>
  );
}
