/**
 * SummaryWorks - сводка по всем работам проекта
 * Группирует работы по типам и показывает детализацию
 */

import React, { memo, useMemo } from 'react';
import { Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProjectData, WorkData, RoomData } from '../../types';
import { calculateRoomMetrics } from '../../utils/geometry';
import { CALCULATION_TYPE_LABELS } from '../../types/workTemplate';

type Props = {
  project: ProjectData;
  onRoomClick: (roomId: string) => void;
};

type WorkAggregate = {
  name: string;
  unit: string;
  calculationType: string;
  totalWorkPrice: number;
  totalMaterialPrice: number;
  totalToolsPrice: number;
  rooms: {
    roomId: string;
    roomName: string;
    count: number;
    workPrice: number;
    materialPrice: number;
    toolsPrice: number;
  }[];
};

/**
 * Получить количество для работы на основе calculationType
 */
function getWorkCount(work: WorkData, room: RoomData): number {
  if (work.useManualQty && work.manualQty !== undefined) {
    return work.manualQty;
  }

  const metrics = calculateRoomMetrics(room);

  switch (work.calculationType) {
    case 'floorArea':
      return metrics.floorArea;
    case 'netWallArea':
      return metrics.netWallArea;
    case 'skirtingLength':
      return metrics.skirtingLength;
    case 'customCount':
      return work.count || 1;
    default:
      return 0;
  }
}

/**
 * Агрегирует работы из всех комнат
 */
function aggregateWorks(project: ProjectData): WorkAggregate[] {
  const workMap = new Map<string, WorkAggregate>();

  project.rooms.forEach(room => {
    room.works.forEach((work: WorkData) => {
      if (!work.enabled) return;

      const key = `${work.name}|${work.unit}`.toLowerCase();
      const existing = workMap.get(key);
      const count = getWorkCount(work, room);
      const workPrice = count * work.workUnitPrice;
      const materialPrice = work.materials?.reduce(
        (sum, m) => sum + m.quantity * m.pricePerUnit,
        0
      ) || 0;
      const toolsPrice = work.tools?.reduce(
        (sum, t) => sum + t.price * t.quantity * (t.isRent ? (t.rentPeriod || 1) : 1),
        0
      ) || 0;

      if (existing) {
        existing.totalWorkPrice += workPrice;
        existing.totalMaterialPrice += materialPrice;
        existing.totalToolsPrice += toolsPrice;
        existing.rooms.push({
          roomId: room.id,
          roomName: room.name,
          count,
          workPrice,
          materialPrice,
          toolsPrice,
        });
      } else {
        workMap.set(key, {
          name: work.name,
          unit: work.unit,
          calculationType: work.calculationType,
          totalWorkPrice: workPrice,
          totalMaterialPrice: materialPrice,
          totalToolsPrice: toolsPrice,
          rooms: [{
            roomId: room.id,
            roomName: room.name,
            count,
            workPrice,
            materialPrice,
            toolsPrice,
          }],
        });
      }
    });
  });

  // Сортируем по убыванию общей стоимости
  return Array.from(workMap.values()).sort((a, b) => {
    const totalA = a.totalWorkPrice + a.totalMaterialPrice + a.totalToolsPrice;
    const totalB = b.totalWorkPrice + b.totalMaterialPrice + b.totalToolsPrice;
    return totalB - totalA;
  });
}

const SummaryWorksInternal: React.FC<Props> = ({ project, onRoomClick }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [expandedWorks, setExpandedWorks] = React.useState<Set<string>>(new Set());

  const works = useMemo(() => aggregateWorks(project), [project]);

  const grandTotalWork = useMemo(
    () => works.reduce((sum, w) => sum + w.totalWorkPrice, 0),
    [works]
  );
  const grandTotalMaterial = useMemo(
    () => works.reduce((sum, w) => sum + w.totalMaterialPrice, 0),
    [works]
  );
  const grandTotalTools = useMemo(
    () => works.reduce((sum, w) => sum + w.totalToolsPrice, 0),
    [works]
  );
  const grandTotal = grandTotalWork + grandTotalMaterial + grandTotalTools;

  const toggleWorkExpand = (workName: string) => {
    setExpandedWorks(prev => {
      const next = new Set(prev);
      if (next.has(workName)) {
        next.delete(workName);
      } else {
        next.add(workName);
      }
      return next;
    });
  };

  if (works.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Заголовок */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-lg">Работы</h3>
            <p className="text-sm text-gray-500">
              {works.length} работ • {Math.ceil(grandTotal).toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Таблица работ */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left p-3 font-medium">Работа</th>
                  <th className="text-right p-3 font-medium w-28">Работа</th>
                  <th className="text-right p-3 font-medium w-28">Материалы</th>
                  <th className="text-right p-3 font-medium w-28">Инструменты</th>
                  <th className="text-right p-3 font-medium w-32">Итого</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {works.map((work, index) => {
                  const isWorkExpanded = expandedWorks.has(work.name);
                  const workTotal = work.totalWorkPrice + work.totalMaterialPrice + work.totalToolsPrice;
                  
                  return (
                    <React.Fragment key={index}>
                      <tr 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => toggleWorkExpand(work.name)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {work.rooms.length > 1 ? (
                              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isWorkExpanded ? 'rotate-90' : ''}`} />
                            ) : (
                              <span className="w-4" />
                            )}
                            <div>
                              <div className="font-medium text-sm">{work.name}</div>
                              <div className="text-xs text-gray-400">
                                {work.rooms.length} {work.rooms.length === 1 ? 'комната' : 'комнаты'} • по {CALCULATION_TYPE_LABELS[work.calculationType as keyof typeof CALCULATION_TYPE_LABELS] || work.calculationType}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right text-sm">
                          {Math.ceil(work.totalWorkPrice).toLocaleString('ru-RU')} ₽
                        </td>
                        <td className="p-3 text-right text-sm text-emerald-600">
                          {work.totalMaterialPrice > 0 && `${Math.ceil(work.totalMaterialPrice).toLocaleString('ru-RU')} ₽`}
                        </td>
                        <td className="p-3 text-right text-sm text-amber-600">
                          {work.totalToolsPrice > 0 && `${Math.ceil(work.totalToolsPrice).toLocaleString('ru-RU')} ₽`}
                        </td>
                        <td className="p-3 text-right font-medium text-sm">
                          {Math.ceil(workTotal).toLocaleString('ru-RU')} ₽
                        </td>
                      </tr>
                      
                      {/* Развёрнутая детализация по комнатам */}
                      {isWorkExpanded && work.rooms.length > 1 && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={5} className="p-0">
                            <div className="px-6 py-2 space-y-1">
                              {work.rooms.map((room, roomIndex) => {
                                const roomTotal = room.workPrice + room.materialPrice + room.toolsPrice;
                                return (
                                  <div 
                                    key={roomIndex}
                                    className="flex items-center justify-between text-xs py-1 hover:bg-white rounded px-2 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRoomClick(room.roomId);
                                    }}
                                  >
                                    <span className="text-gray-600 hover:text-indigo-600">
                                      {room.roomName}
                                      <span className="text-gray-400 ml-1">
                                        ({room.count.toFixed(1)} {work.unit})
                                      </span>
                                    </span>
                                    <span className="font-medium">
                                      {Math.ceil(roomTotal).toLocaleString('ru-RU')} ₽
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 text-sm">
                  <td className="p-3 font-medium">Итого</td>
                  <td className="p-3 text-right font-medium text-blue-600">
                    {Math.ceil(grandTotalWork).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="p-3 text-right font-medium text-emerald-600">
                    {grandTotalMaterial > 0 && `${Math.ceil(grandTotalMaterial).toLocaleString('ru-RU')} ₽`}
                  </td>
                  <td className="p-3 text-right font-medium text-amber-600">
                    {grandTotalTools > 0 && `${Math.ceil(grandTotalTools).toLocaleString('ru-RU')} ₽`}
                  </td>
                  <td className="p-3 text-right font-bold">
                    {Math.ceil(grandTotal).toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Иконка ChevronRight
const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const SummaryWorks = memo(SummaryWorksInternal, (prev, next) => {
  const prevWorksCount = prev.project.rooms.reduce(
    (sum, r) => sum + r.works.filter(w => w.enabled).length,
    0
  );
  const nextWorksCount = next.project.rooms.reduce(
    (sum, r) => sum + r.works.filter(w => w.enabled).length,
    0
  );
  return prevWorksCount === nextWorksCount && prev.project.rooms === next.project.rooms;
});
