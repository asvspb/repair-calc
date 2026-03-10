/**
 * SummaryMaterials - сводка по всем материалам проекта
 * Агрегирует материалы из всех комнат и работ
 */

import React, { memo, useMemo } from 'react';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProjectData, Material, WorkData } from '../../types';

type Props = {
  project: ProjectData;
};

type MaterialAggregate = {
  name: string;
  unit: string;
  totalQuantity: number;
  totalPrice: number;
  rooms: string[]; // названия комнат, где используется
};

/**
 * Агрегирует материалы из всех работ по всем комнатам
 */
function aggregateMaterials(project: ProjectData): MaterialAggregate[] {
  const materialMap = new Map<string, MaterialAggregate>();

  project.rooms.forEach(room => {
    room.works.forEach((work: WorkData) => {
      if (!work.materials || !work.enabled) return;

      work.materials.forEach((material: Material) => {
        const key = `${material.name}|${material.unit}`.toLowerCase();
        const existing = materialMap.get(key);

        if (existing) {
          existing.totalQuantity += material.quantity;
          existing.totalPrice += material.quantity * material.pricePerUnit;
          if (!existing.rooms.includes(room.name)) {
            existing.rooms.push(room.name);
          }
        } else {
          materialMap.set(key, {
            name: material.name,
            unit: material.unit,
            totalQuantity: material.quantity,
            totalPrice: material.quantity * material.pricePerUnit,
            rooms: [room.name],
          });
        }
      });
    });
  });

  // Сортируем по убыванию стоимости
  return Array.from(materialMap.values()).sort((a, b) => b.totalPrice - a.totalPrice);
}

const SummaryMaterialsInternal: React.FC<Props> = ({ project }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const materials = useMemo(() => aggregateMaterials(project), [project]);
  const grandTotal = useMemo(
    () => materials.reduce((sum, m) => sum + m.totalPrice, 0),
    [materials]
  );

  if (materials.length === 0) {
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
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Package className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-lg">Материалы</h3>
            <p className="text-sm text-gray-500">
              {materials.length} позиций • {Math.ceil(grandTotal).toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Таблица материалов */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left p-3 font-medium">Материал</th>
                  <th className="text-right p-3 font-medium w-24">Кол-во</th>
                  <th className="text-right p-3 font-medium w-32">Сумма</th>
                  <th className="text-left p-3 font-medium w-40">Комнаты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {materials.map((material, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-sm">{material.name}</div>
                    </td>
                    <td className="p-3 text-right text-sm">
                      {material.totalQuantity.toLocaleString('ru-RU')}{' '}
                      <span className="text-gray-400">{material.unit}</span>
                    </td>
                    <td className="p-3 text-right font-medium text-sm">
                      {Math.ceil(material.totalPrice).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {material.rooms.slice(0, 2).map((room, i) => (
                          <span
                            key={i}
                            className="text-xs px-1.5 py-0.5 bg-gray-100 rounded"
                          >
                            {room}
                          </span>
                        ))}
                        {material.rooms.length > 2 && (
                          <span className="text-xs text-gray-400">
                            +{material.rooms.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-medium">
                  <td className="p-3" colSpan={2}>
                    Итого материалы
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

export const SummaryMaterials = memo(SummaryMaterialsInternal, (prev, next) => {
  // Сравниваем количество работ и материалы в них
  const prevMaterialsCount = prev.project.rooms.reduce(
    (sum, r) => sum + r.works.reduce((s, w) => s + (w.materials?.length || 0), 0),
    0
  );
  const nextMaterialsCount = next.project.rooms.reduce(
    (sum, r) => sum + r.works.reduce((s, w) => s + (w.materials?.length || 0), 0),
    0
  );
  return prevMaterialsCount === nextMaterialsCount && prev.project.rooms === next.project.rooms;
});