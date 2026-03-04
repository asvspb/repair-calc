import { Trash2 } from 'lucide-react';
import type { ProjectData } from '../types';
import { calculateRoomMetrics } from '../utils/geometry';
import { calculateRoomCosts } from '../utils/costs';

interface SummaryViewProps {
  project: ProjectData;
  updateProject: (p: ProjectData) => void;
  deleteProject: () => void;
  onRoomClick: (roomId: string) => void;
}

export function SummaryView({ project, updateProject, deleteProject, onRoomClick }: SummaryViewProps) {
  let totalFloorArea = 0;
  let totalWallArea = 0;
  let totalVolume = 0;
  let totalWorkCost = 0;
  let totalMaterialCost = 0;
  let totalToolsCost = 0;

  project.rooms.forEach(r => {
    const metrics = calculateRoomMetrics(r);
    const costs = calculateRoomCosts(r);
    totalFloorArea += metrics.floorArea;
    totalWallArea += metrics.netWallArea;
    totalVolume += metrics.volume || 0;
    totalWorkCost += costs.totalWork;
    totalMaterialCost += costs.totalMaterial;
    totalToolsCost += costs.totalTools;
  });

  const grandTotal = totalWorkCost + totalMaterialCost + totalToolsCost;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <input
          className="text-3xl font-light text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full max-w-md"
          value={project.name}
          onChange={e => updateProject({...project, name: e.target.value})}
          placeholder="Название объекта"
        />
        <button onClick={deleteProject} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer" title="Удалить объект">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Площадь пола</div>
          <div className="text-3xl font-light">{totalFloorArea.toFixed(2)} <span className="text-lg text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Площадь стен</div>
          <div className="text-3xl font-light">{totalWallArea.toFixed(2)} <span className="text-lg text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <div className="text-sm text-gray-500 mb-1">Общий объем</div>
          <div className="text-3xl font-light">{totalVolume.toFixed(2)} <span className="text-lg text-gray-400">м³</span></div>
        </div>
        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-md flex flex-col items-center text-center">
          <div className="text-indigo-100 text-sm mb-1">Стоимость, ₽</div>
          <div className="text-3xl font-semibold">{Math.ceil(grandTotal).toLocaleString('ru-RU')}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-medium">Детализация по комнатам</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {project.rooms.map(room => {
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
          {project.rooms.length === 0 && (
            <div className="p-6 text-center text-gray-500 italic">
              Нет добавленных комнат
            </div>
          )}
        </div>
      </div>
    </div>
  );
}