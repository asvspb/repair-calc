import React, { memo } from 'react';
import type { ProjectData, ObjectData, RoomData } from '../types';
import { calculateRoomMetrics } from '../utils/geometry';
import { calculateRoomCosts } from '../utils/costs';
import { SummaryMaterials, SummaryTools, SummaryWorks } from './summary';
import { getAllRooms } from '../utils/projectObjects';
import { pluralize } from '../utils/format';

interface SummaryViewProps {
  project: ProjectData;
  onRoomClick: (roomId: string) => void;
  groupByObject?: boolean;
}

type ObjectSummary = {
  object: ObjectData;
  totalFloorArea: number;
  totalWallArea: number;
  totalVolume: number;
  totalWorkCost: number;
  totalMaterialCost: number;
  totalToolsCost: number;
  grandTotal: number;
  rooms: Array<{
    room: RoomData;
    costs: ReturnType<typeof calculateRoomCosts>;
    metrics: ReturnType<typeof calculateRoomMetrics>;
  }>;
};

const SummaryViewInternal: React.FC<SummaryViewProps> = ({
  project,
  onRoomClick,
  groupByObject = false,
}) => {
  const allRooms = getAllRooms(project);
  const objects = project.objects || [];
  const hasMultipleObjects = objects.length > 1;
  const shouldGroupByObject = groupByObject && hasMultipleObjects;

  // Calculate room-level metrics
  const calculateRoomData = (rooms: RoomData[]) => {
    let totalFloorArea = 0;
    let totalWallArea = 0;
    let totalVolume = 0;
    let totalWorkCost = 0;
    let totalMaterialCost = 0;
    let totalToolsCost = 0;

    const roomData = rooms.map(room => {
      const metrics = calculateRoomMetrics(room);
      const costs = calculateRoomCosts(room);

      totalFloorArea += metrics.floorArea;
      totalWallArea += metrics.netWallArea;
      totalVolume += metrics.volume || 0;
      totalWorkCost += costs.totalWork;
      totalMaterialCost += costs.totalMaterial;
      totalToolsCost += costs.totalTools;

      return { room, costs, metrics };
    });

    return {
      totalFloorArea,
      totalWallArea,
      totalVolume,
      totalWorkCost,
      totalMaterialCost,
      totalToolsCost,
      grandTotal: totalWorkCost + totalMaterialCost + totalToolsCost,
      roomData,
    };
  };

  // Calculate per-object summaries if grouping
  const objectSummaries: ObjectSummary[] = shouldGroupByObject
    ? objects.map(obj => {
        const rooms = obj.rooms || [];
        const roomData = calculateRoomData(rooms);
        return {
          object: obj,
          ...roomData,
          rooms: roomData.roomData,
        };
      })
    : [];

  // Calculate grand totals across all objects
  const grandTotals = shouldGroupByObject
    ? objectSummaries.reduce((acc, obj) => ({
        totalFloorArea: acc.totalFloorArea + obj.totalFloorArea,
        totalWallArea: acc.totalWallArea + obj.totalWallArea,
        totalVolume: acc.totalVolume + obj.totalVolume,
        totalWorkCost: acc.totalWorkCost + obj.totalWorkCost,
        totalMaterialCost: acc.totalMaterialCost + obj.totalMaterialCost,
        totalToolsCost: acc.totalToolsCost + obj.totalToolsCost,
        grandTotal: acc.grandTotal + obj.grandTotal,
      }), {
        totalFloorArea: 0,
        totalWallArea: 0,
        totalVolume: 0,
        totalWorkCost: 0,
        totalMaterialCost: 0,
        totalToolsCost: 0,
        grandTotal: 0,
      })
    : calculateRoomData(allRooms);

  // Metrics cards component (reusable)
  const renderMetricsCards = (data: typeof grandTotals, isGrandTotal: boolean = false) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className={`p-4 rounded-2xl shadow-sm border flex flex-col items-center text-center ${
        isGrandTotal ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-100'
      }`}>
        <div className={`text-sm mb-1 ${isGrandTotal ? 'text-indigo-100' : 'text-gray-500'}`}>Площадь пола</div>
        <div className="text-2xl font-light">{data.totalFloorArea.toFixed(2)} <span className={`text-lg ${isGrandTotal ? 'text-indigo-200' : 'text-gray-400'}`}>м²</span></div>
      </div>
      <div className={`p-4 rounded-2xl shadow-sm border flex flex-col items-center text-center ${
        isGrandTotal ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-100'
      }`}>
        <div className={`text-sm mb-1 ${isGrandTotal ? 'text-indigo-100' : 'text-gray-500'}`}>Площадь стен</div>
        <div className="text-2xl font-light">{data.totalWallArea.toFixed(2)} <span className={`text-lg ${isGrandTotal ? 'text-indigo-200' : 'text-gray-400'}`}>м²</span></div>
      </div>
      <div className={`p-4 rounded-2xl shadow-sm border flex flex-col items-center text-center ${
        isGrandTotal ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-100'
      }`}>
        <div className={`text-sm mb-1 ${isGrandTotal ? 'text-indigo-100' : 'text-gray-500'}`}>Общий объем</div>
        <div className="text-2xl font-light">{data.totalVolume.toFixed(2)} <span className={`text-lg ${isGrandTotal ? 'text-indigo-200' : 'text-gray-400'}`}>м³</span></div>
      </div>
      <div className={`p-4 rounded-2xl shadow-md flex flex-col items-center text-center ${
        isGrandTotal ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-100'
      }`}>
        <div className={`text-sm mb-1 ${isGrandTotal ? 'text-indigo-100' : 'text-gray-500'}`}>Стоимость, ₽</div>
        <div className="text-2xl font-semibold">{Math.ceil(data.grandTotal).toLocaleString('ru-RU')}</div>
      </div>
    </div>
  );

  // Object card with rooms
  const renderObjectSection = (objSummary: ObjectSummary) => (
    <div key={objSummary.object.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Object header */}
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">📁</span>
          <h3 className="font-medium text-lg">{objSummary.object.name}</h3>
          {objSummary.object.city && (
            <span className="text-sm text-gray-500">({objSummary.object.city})</span>
          )}
        </div>
        <div className="text-xl font-light">
          {Math.ceil(objSummary.grandTotal).toLocaleString('ru-RU')} ₽
        </div>
      </div>

      {/* Rooms list */}
      <div className="divide-y divide-gray-100">
        {objSummary.rooms.map(({ room, costs }) => (
          <div key={room.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <button
                onClick={() => onRoomClick(room.id)}
                className="font-medium text-left hover:text-indigo-600 transition-colors cursor-pointer"
              >
                {room.name}
              </button>
              <div className="text-sm text-gray-500 mt-1">
                Работы: {Math.ceil(costs.totalWork).toLocaleString('ru-RU')} ₽ • Материалы: {Math.ceil(costs.totalMaterial).toLocaleString('ru-RU')} ₽{Math.ceil(costs.totalTools) > 0 && (
                  <span> • Инструменты: {Math.ceil(costs.totalTools).toLocaleString('ru-RU')} ₽</span>
                )}
              </div>
            </div>
            <div className="text-xl font-light">
              {Math.ceil(costs.total).toLocaleString('ru-RU')} ₽
            </div>
          </div>
        ))}
        {objSummary.rooms.length === 0 && (
          <div className="p-6 text-center text-gray-500 italic">
            Нет добавленных комнат
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-2xl font-semibold">
          Общая смета
          {shouldGroupByObject && (
            <span className="text-base font-normal text-gray-500 ml-2">
              ({objects.length} {pluralize(objects.length, 'объект', 'объекта', 'объектов')})
            </span>
          )}
        </h2>
      </div>

      {/* Grand totals */}
      {renderMetricsCards(grandTotals, shouldGroupByObject)}

      {/* Object grouping or flat room list */}
      {shouldGroupByObject ? (
        <>
          {/* Per-object sections */}
          <div className="space-y-4">
            {objectSummaries.map(objSummary => renderObjectSection(objSummary))}
          </div>
        </>
      ) : (
        /* Flat room list (single object or no grouping) */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-medium">Детализация по комнатам</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {allRooms.map(room => {
              const costs = calculateRoomCosts(room);
              return (
                <div key={room.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <button
                      onClick={() => onRoomClick(room.id)}
                      className="font-medium text-lg text-left hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      {room.name}
                    </button>
                    <div className="text-sm text-gray-500 mt-1">
                      Работы: {Math.ceil(costs.totalWork).toLocaleString('ru-RU')} ₽ • Материалы: {Math.ceil(costs.totalMaterial).toLocaleString('ru-RU')} ₽{Math.ceil(costs.totalTools) > 0 && (
                        <span> • Инструменты: {Math.ceil(costs.totalTools).toLocaleString('ru-RU')} ₽</span>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-light">
                    {Math.ceil(costs.total).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              );
            })}
            {allRooms.length === 0 && (
              <div className="p-6 text-center text-gray-500 italic">
                Нет добавленных комнат
              </div>
            )}
          </div>
        </div>
      )}

      {/* Extended details: works, materials, tools */}
      <SummaryWorks project={project} onRoomClick={onRoomClick} groupByObject={shouldGroupByObject} />
      <SummaryMaterials project={project} groupByObject={shouldGroupByObject} />
      <SummaryTools project={project} groupByObject={shouldGroupByObject} />
    </div>
  );
};

/**
 * Экспортируемый компонент с мемоизацией.
 * Сравниваем id проекта, название и количество комнат для оптимизации.
 */
export const SummaryView = memo(SummaryViewInternal, (prevProps, nextProps) => {
  const prevRoomsCount = prevProps.project.objects ? getAllRooms(prevProps.project).length : (prevProps.project.rooms?.length || 0);
  const nextRoomsCount = nextProps.project.objects ? getAllRooms(nextProps.project).length : (nextProps.project.rooms?.length || 0);

  return (
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.name === nextProps.project.name &&
    prevRoomsCount === nextRoomsCount &&
    prevProps.project.rooms === nextProps.project.rooms &&
    prevProps.groupByObject === nextProps.groupByObject
  );
});
