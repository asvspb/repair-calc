/**
 * SummaryTools - сводка по всем инструментам проекта
 * Агрегирует инструменты из всех комнат и работ
 */

import React, { memo, useMemo } from 'react';
import { Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProjectData, Tool, WorkData } from '../../types';

type Props = {
  project: ProjectData;
};

type ToolAggregate = {
  name: string;
  totalQuantity: number;
  totalPrice: number;
  isRent: boolean;
  totalRentPeriod: number;
  rooms: string[];
};

/**
 * Агрегирует инструменты из всех работ по всем комнатам
 */
function aggregateTools(project: ProjectData): ToolAggregate[] {
  const toolMap = new Map<string, ToolAggregate>();

  project.rooms.forEach(room => {
    room.works.forEach((work: WorkData) => {
      if (!work.tools || !work.enabled) return;

      work.tools.forEach((tool: Tool) => {
        const key = `${tool.name}|${tool.isRent}`.toLowerCase();
        const existing = toolMap.get(key);

        if (existing) {
          existing.totalQuantity += tool.quantity;
          existing.totalPrice += tool.price * tool.quantity * (tool.isRent ? (tool.rentPeriod || 1) : 1);
          existing.totalRentPeriod += tool.rentPeriod || 0;
          if (!existing.rooms.includes(room.name)) {
            existing.rooms.push(room.name);
          }
        } else {
          toolMap.set(key, {
            name: tool.name,
            totalQuantity: tool.quantity,
            totalPrice: tool.price * tool.quantity * (tool.isRent ? (tool.rentPeriod || 1) : 1),
            isRent: tool.isRent,
            totalRentPeriod: tool.rentPeriod || 0,
            rooms: [room.name],
          });
        }
      });
    });
  });

  // Сортируем: сначала аренда, потом покупка, по убыванию стоимости
  return Array.from(toolMap.values()).sort((a, b) => {
    if (a.isRent !== b.isRent) return a.isRent ? -1 : 1;
    return b.totalPrice - a.totalPrice;
  });
}

const SummaryToolsInternal: React.FC<Props> = ({ project }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const tools = useMemo(() => aggregateTools(project), [project]);
  const grandTotal = useMemo(
    () => tools.reduce((sum, t) => sum + t.totalPrice, 0),
    [tools]
  );

  // Разделяем на аренду и покупку
  const rentTools = tools.filter(t => t.isRent);
  const buyTools = tools.filter(t => !t.isRent);

  const rentTotal = rentTools.reduce((sum, t) => sum + t.totalPrice, 0);
  const buyTotal = buyTools.reduce((sum, t) => sum + t.totalPrice, 0);

  if (tools.length === 0) {
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
          <div className="p-2 bg-amber-100 rounded-lg">
            <Wrench className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-lg">Инструменты</h3>
            <p className="text-sm text-gray-500">
              {tools.length} позиций • {Math.ceil(grandTotal).toLocaleString('ru-RU')} ₽
              {rentTools.length > 0 && (
                <span className="text-amber-600 ml-2">
                  (аренда: {Math.ceil(rentTotal).toLocaleString('ru-RU')} ₽)
                </span>
              )}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Таблица инструментов */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left p-3 font-medium">Инструмент</th>
                  <th className="text-center p-3 font-medium w-20">Тип</th>
                  <th className="text-right p-3 font-medium w-24">Кол-во</th>
                  <th className="text-right p-3 font-medium w-32">Сумма</th>
                  <th className="text-left p-3 font-medium w-40">Комнаты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Аренда */}
                {rentTools.map((tool, index) => (
                  <tr key={`rent-${index}`} className="hover:bg-amber-50/50 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-sm">{tool.name}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                        Аренда
                      </span>
                    </td>
                    <td className="p-3 text-right text-sm">
                      {tool.totalQuantity} шт
                      {tool.totalRentPeriod > 0 && (
                        <span className="text-gray-400 text-xs block">
                          {tool.totalRentPeriod} дн.
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium text-sm">
                      {Math.ceil(tool.totalPrice).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {tool.rooms.slice(0, 2).map((room, i) => (
                          <span
                            key={i}
                            className="text-xs px-1.5 py-0.5 bg-gray-100 rounded"
                          >
                            {room}
                          </span>
                        ))}
                        {tool.rooms.length > 2 && (
                          <span className="text-xs text-gray-400">
                            +{tool.rooms.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Покупка */}
                {buyTools.map((tool, index) => (
                  <tr key={`buy-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-sm">{tool.name}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        Покупка
                      </span>
                    </td>
                    <td className="p-3 text-right text-sm">
                      {tool.totalQuantity} шт
                    </td>
                    <td className="p-3 text-right font-medium text-sm">
                      {Math.ceil(tool.totalPrice).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {tool.rooms.slice(0, 2).map((room, i) => (
                          <span
                            key={i}
                            className="text-xs px-1.5 py-0.5 bg-gray-100 rounded"
                          >
                            {room}
                          </span>
                        ))}
                        {tool.rooms.length > 2 && (
                          <span className="text-xs text-gray-400">
                            +{tool.rooms.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {rentTotal > 0 && (
                  <tr className="bg-amber-50 text-sm">
                    <td className="p-3 font-medium" colSpan={3}>
                      Итого аренда
                    </td>
                    <td className="p-3 text-right font-medium">
                      {Math.ceil(rentTotal).toLocaleString('ru-RU')} ₽
                    </td>
                    <td></td>
                  </tr>
                )}
                {buyTotal > 0 && (
                  <tr className="bg-gray-50 text-sm">
                    <td className="p-3 font-medium" colSpan={3}>
                      Итого покупка
                    </td>
                    <td className="p-3 text-right font-medium">
                      {Math.ceil(buyTotal).toLocaleString('ru-RU')} ₽
                    </td>
                    <td></td>
                  </tr>
                )}
                <tr className="bg-amber-100 font-medium">
                  <td className="p-3" colSpan={3}>
                    Итого инструменты
                  </td>
                  <td className="p-3 text-right">
                    {Math.ceil(grandTotal).toLocaleString('ru-RU')} ₽
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export const SummaryTools = memo(SummaryToolsInternal, (prev, next) => {
  const prevToolsCount = prev.project.rooms.reduce(
    (sum, r) => sum + r.works.reduce((s, w) => s + (w.tools?.length || 0), 0),
    0
  );
  const nextToolsCount = next.project.rooms.reduce(
    (sum, r) => sum + r.works.reduce((s, w) => s + (w.tools?.length || 0), 0),
    0
  );
  return prevToolsCount === nextToolsCount && prev.project.rooms === next.project.rooms;
});