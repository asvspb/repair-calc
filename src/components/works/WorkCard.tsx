import { Package, Wrench, X } from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';
import { MaterialPriceSearch, WorkPriceSearch } from './';
import { migrateWorkData } from '../../domain/pricing/costs';
import type { RoomMetrics } from '../../types';
import type { CalculationType, Material, Tool, WorkData, RoomData } from '@shared/types';

export interface WorkCardHandlers {
  handleWorkChange: (id: string, field: keyof WorkData, value: string | number | boolean) => void;
  handleMaterialChange: (
    workId: string,
    materialId: string,
    field: keyof Material,
    value: string | number,
  ) => void;
  addMaterial: (workId: string) => void;
  removeMaterial: (workId: string, materialId: string) => void;
  handleToolChange: (
    workId: string,
    toolId: string,
    field: keyof Tool,
    value: string | number | boolean,
  ) => void;
  addTool: (workId: string) => void;
  removeTool: (workId: string, toolId: string) => void;
}

interface WorkCardProps {
  work: WorkData;
  roomId: string;
  city?: string;
  handlers: WorkCardHandlers;
  metrics: RoomMetrics;
  updateRoomById?: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
}

export function WorkCard({ work, roomId, city, handlers, metrics }: WorkCardProps) {
  const migratedWork = migrateWorkData(work);

  let autoQty = 0;
  if (work.calculationType === 'floorArea') autoQty = metrics.floorArea;
  else if (work.calculationType === 'netWallArea') autoQty = metrics.netWallArea;
  else if (work.calculationType === 'skirtingLength') autoQty = metrics.skirtingLength;
  else if (work.calculationType === 'customCount') autoQty = work.count || 0;

  const qty = work.manualQty !== undefined ? work.manualQty : autoQty;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Расчет по</label>
          <select
            value={work.calculationType}
            onChange={e => {
              const val = e.target.value as CalculationType;
              const newUnit =
                val === 'floorArea' || val === 'netWallArea'
                  ? 'м²'
                  : val === 'skirtingLength'
                    ? 'пог. м'
                    : 'шт';
              if (updateRoomById) {
                updateRoomById(roomId, (prev: RoomData) => ({
                  ...prev,
                  works: (prev.works || []).map((w: WorkData) => {
                    if (w.id !== work.id) return w;
                    const updatedWork: WorkData = {
                      ...w,
                      calculationType: val,
                      unit: newUnit,
                    };
                    if (val !== 'customCount') {
                      delete updatedWork.manualQty;
                    }
                    return updatedWork;
                  }),
                }));
              }
            }}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="floorArea">Площади пола</option>
            <option value="netWallArea">Площади стен</option>
            <option value="skirtingLength">Периметру</option>
            <option value="customCount">Вручную (шт)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Объем ({work.unit})</label>
          {work.calculationType === 'customCount' ? (
            <NumberInput
              data-testid="work-quantity-input"
              value={work.count || 0}
              onChange={(v: number) => handlers.handleWorkChange(work.id, 'count', v)}
              className="w-full"
              step={0.1}
            />
          ) : (
            <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">
              {autoQty.toFixed(2)}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Цена работы (за ед.)</label>
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <NumberInput
                data-testid="work-price-input"
                value={work.workUnitPrice}
                onChange={(v: number) => handlers.handleWorkChange(work.id, 'workUnitPrice', v)}
                className="w-full pr-8"
                step={0.1}
              />
              <span className="absolute right-3 top-2 text-gray-400 text-sm">₽</span>
            </div>
            <WorkPriceSearch
              workName={work.name}
              unit={work.unit}
              city={city}
              onPriceFound={price => handlers.handleWorkChange(work.id, 'workUnitPrice', price)}
            />
          </div>
        </div>
        <div className="flex items-end">
          <div className="text-sm text-gray-600">
            Стоимость работы:{' '}
            <span data-testid="work-cost" className="font-semibold text-indigo-900">
              {Math.ceil(qty * work.workUnitPrice).toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 justify-center">
          <Package className="w-4 h-4 text-emerald-600" />
          <h4 className="font-medium text-gray-700">Материалы</h4>
          {(migratedWork.materials?.length || 0) > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {Math.ceil(
                migratedWork.materials!.reduce((sum, m) => sum + m.quantity * m.pricePerUnit, 0),
              ).toLocaleString('ru-RU')}{' '}
              ₽
            </span>
          )}
        </div>

        {(migratedWork.materials || []).length === 0 ? (
          <div className="text-sm text-gray-400 italic mb-3">Нет материалов</div>
        ) : (
          <div className="space-y-2 mb-3">
            {(migratedWork.materials || []).map((material, i) => (
              <div
                key={material.id}
                className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-100"
              >
                <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                <input
                  data-testid="material-name-input"
                  value={material.name}
                  onChange={e =>
                    handlers.handleMaterialChange(work.id, material.id, 'name', e.target.value)
                  }
                  placeholder="Название"
                  className="flex-1 min-w-[120px] px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
                />
                <div className="flex items-center gap-1">
                  <NumberInput
                    value={material.quantity}
                    onChange={v =>
                      handlers.handleMaterialChange(work.id, material.id, 'quantity', v)
                    }
                    className="w-16 text-sm py-1"
                    step={0.1}
                  />
                  <input
                    data-testid="material-unit-input"
                    value={material.unit}
                    onChange={e =>
                      handlers.handleMaterialChange(work.id, material.id, 'unit', e.target.value)
                    }
                    className="w-12 px-1 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm text-center"
                    placeholder="ед."
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs">×</span>
                  <div className="relative">
                    <NumberInput
                      value={material.pricePerUnit}
                      onChange={v =>
                        handlers.handleMaterialChange(work.id, material.id, 'pricePerUnit', v)
                      }
                      className="w-24 pr-7 text-sm py-1.5"
                      step={0.1}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ₽
                    </span>
                  </div>
                  <MaterialPriceSearch
                    materialName={material.name}
                    city={city}
                    onPriceFound={price =>
                      handlers.handleMaterialChange(work.id, material.id, 'pricePerUnit', price)
                    }
                  />
                </div>
                <div className="text-sm text-gray-600 min-w-[80px] text-right">
                  = {Math.ceil(material.quantity * material.pricePerUnit).toLocaleString('ru-RU')} ₽
                </div>
                <button
                  onClick={() => handlers.removeMaterial(work.id, material.id)}
                  className="p-1 text-gray-300 hover:text-red-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => handlers.addMaterial(work.id)}
          data-testid="add-material-btn"
          className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
        >
          + Добавить материал
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 justify-center">
          <Wrench className="w-4 h-4 text-amber-600" />
          <h4 className="font-medium text-gray-700">Инструменты</h4>
          {(migratedWork.tools?.length || 0) > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {Math.ceil(
                migratedWork.tools!.reduce((sum, t) => {
                  if (t.isRent && t.rentPeriod) {
                    return sum + t.price * t.quantity * t.rentPeriod;
                  }
                  return sum + t.price * t.quantity;
                }, 0),
              ).toLocaleString('ru-RU')}{' '}
              ₽
            </span>
          )}
        </div>

        {(migratedWork.tools || []).length === 0 ? (
          <div className="text-sm text-gray-400 italic mb-3">Нет инструментов</div>
        ) : (
          <div className="space-y-2 mb-3">
            {(migratedWork.tools || []).map((tool, i) => {
              const toolCost =
                tool.isRent && tool.rentPeriod
                  ? tool.price * tool.quantity * tool.rentPeriod
                  : tool.price * tool.quantity;

              return (
                <div
                  key={tool.id}
                  className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-100"
                >
                  <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                  <input
                    value={tool.name}
                    onChange={e =>
                      handlers.handleToolChange(work.id, tool.id, 'name', e.target.value)
                    }
                    placeholder="Название"
                    className="flex-1 min-w-[120px] px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <NumberInput
                      value={tool.quantity}
                      onChange={v => handlers.handleToolChange(work.id, tool.id, 'quantity', v)}
                      className="w-14 text-sm py-1"
                      min={1}
                    />
                    <span className="text-gray-400 text-xs">шт</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <NumberInput
                      value={tool.price}
                      onChange={v => handlers.handleToolChange(work.id, tool.id, 'price', v)}
                      className="w-20 text-sm py-1"
                    />
                    <span className="text-gray-400 text-xs">₽</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tool.isRent}
                        onChange={e =>
                          handlers.handleToolChange(work.id, tool.id, 'isRent', e.target.checked)
                        }
                        className="w-4 h-4 text-amber-600 rounded border-gray-300"
                      />
                      Аренда
                    </label>
                    {tool.isRent && (
                      <div className="flex items-center gap-1">
                        <NumberInput
                          value={tool.rentPeriod || 1}
                          onChange={v =>
                            handlers.handleToolChange(work.id, tool.id, 'rentPeriod', v)
                          }
                          className="w-12 text-sm py-1"
                          min={1}
                        />
                        <span className="text-gray-400 text-xs">дн.</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 min-w-[80px] text-right">
                    = {Math.ceil(toolCost).toLocaleString('ru-RU')} ₽
                  </div>
                  <button
                    onClick={() => handlers.removeTool(work.id, tool.id)}
                    className="p-1 text-gray-300 hover:text-red-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => handlers.addTool(work.id)}
          className="text-sm text-amber-600 font-medium hover:text-amber-700"
        >
          + Добавить инструмент
        </button>
      </div>
    </div>
  );
}
