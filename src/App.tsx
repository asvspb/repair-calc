import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, Menu, X, ChevronRight, LayoutDashboard, Settings2, Save } from 'lucide-react';
import { useProjects } from './hooks/useProjects';
import { BackupManager } from './components/BackupManager';
import { StorageManager } from './utils/storage';

export type Opening = {
  id: string;
  width: number;
  height: number;
};

export type CalculationType = 'floorArea' | 'netWallArea' | 'skirtingLength' | 'customCount';

export type WorkData = {
  id: string;
  name: string;
  unit: string;
  enabled: boolean;
  workUnitPrice: number;
  materialPriceType: 'per_unit' | 'total';
  materialPrice: number;
  count?: number;
  calculationType: CalculationType;
  isCustom?: boolean;
};

export type RoomData = {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  windows: Opening[];
  doors: Opening[];
  works: WorkData[];
};

export type ProjectData = {
  id: string;
  name: string;
  rooms: RoomData[];
};

const initialRooms: RoomData[] = [
  {
    id: '1',
    name: 'Комната 1',
    length: 3.6,
    width: 2.9,
    height: 2.6,
    windows: [{ id: 'w1', width: 1.5, height: 1.5 }],
    doors: [{ id: 'd1', width: 1.0, height: 2.2 }],
    works: [
      { id: 'floorLeveling', name: 'Выравнивание пола', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 400, materialPriceType: 'total', materialPrice: 2500, isCustom: true },
      { id: 'laminate', name: 'Укладка ламината', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'skirting', name: 'Монтаж плинтусов', unit: 'пог. м', calculationType: 'skirtingLength', enabled: true, workUnitPrice: 200, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'puttying', name: 'Шпаклевание стен', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 450, materialPriceType: 'total', materialPrice: 3500, isCustom: true },
      { id: 'wallpaper', name: 'Поклейка обоев', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 800, isCustom: true },
      { id: 'ceiling', name: 'Натяжной потолок', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 900, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'doorInstall', name: 'Установка дверей', unit: 'шт', calculationType: 'customCount', enabled: true, workUnitPrice: 4500, materialPriceType: 'total', materialPrice: 15000, count: 1, isCustom: true },
      { id: 'electrical', name: 'Электрика', unit: 'точек', calculationType: 'customCount', enabled: true, workUnitPrice: 300, materialPriceType: 'total', materialPrice: 4000, count: 6, isCustom: true },
    ]
  },
  {
    id: '2',
    name: 'Комната 2',
    length: 4.9,
    width: 3.6,
    height: 2.6,
    windows: [{ id: 'w2', width: 1.4, height: 2.1 }],
    doors: [{ id: 'd2', width: 2.2, height: 2.5 }],
    works: [
      { id: 'floorLeveling', name: 'Выравнивание пола', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 400, materialPriceType: 'total', materialPrice: 4500, isCustom: true },
      { id: 'laminate', name: 'Укладка ламината', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'skirting', name: 'Монтаж плинтусов', unit: 'пог. м', calculationType: 'skirtingLength', enabled: true, workUnitPrice: 200, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'puttying', name: 'Шпаклевание стен', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 450, materialPriceType: 'total', materialPrice: 4500, isCustom: true },
      { id: 'wallpaper', name: 'Поклейка обоев', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 350, materialPriceType: 'total', materialPrice: 1200, isCustom: true },
      { id: 'ceiling', name: 'Натяжной потолок', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 900, materialPriceType: 'total', materialPrice: 0, isCustom: true },
      { id: 'doorInstall', name: 'Установка дверей', unit: 'шт', calculationType: 'customCount', enabled: true, workUnitPrice: 8000, materialPriceType: 'total', materialPrice: 35000, count: 1, isCustom: true },
      { id: 'electrical', name: 'Электрика', unit: 'точек', calculationType: 'customCount', enabled: true, workUnitPrice: 300, materialPriceType: 'total', materialPrice: 6500, count: 10, isCustom: true },
    ]
  }
];

const initialProjects: ProjectData[] = [
  {
    id: 'p1',
    name: 'Квартира (пример)',
    rooms: initialRooms
  }
];

const createNewProject = (): ProjectData => ({
  id: Math.random().toString(36).substr(2, 9),
  name: 'Новый объект',
  rooms: []
});

const createNewRoom = (): RoomData => ({
  id: Math.random().toString(36).substr(2, 9),
  name: 'Новая комната',
  length: 4,
  width: 3,
  height: 2.6,
  windows: [{ id: Math.random().toString(), width: 1.5, height: 1.5 }],
  doors: [{ id: Math.random().toString(), width: 0.9, height: 2.0 }],
  works: [
    { id: 'floorLeveling', name: 'Выравнивание пола', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 400, materialPriceType: 'per_unit', materialPrice: 250, isCustom: true },
    { id: 'laminate', name: 'Укладка ламината', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 350, materialPriceType: 'per_unit', materialPrice: 0, isCustom: true },
    { id: 'skirting', name: 'Монтаж плинтусов', unit: 'пог. м', calculationType: 'skirtingLength', enabled: true, workUnitPrice: 200, materialPriceType: 'per_unit', materialPrice: 0, isCustom: true },
    { id: 'puttying', name: 'Шпаклевание стен', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 450, materialPriceType: 'per_unit', materialPrice: 120, isCustom: true },
    { id: 'wallpaper', name: 'Поклейка обоев', unit: 'м²', calculationType: 'netWallArea', enabled: true, workUnitPrice: 350, materialPriceType: 'per_unit', materialPrice: 30, isCustom: true },
    { id: 'ceiling', name: 'Натяжной потолок', unit: 'м²', calculationType: 'floorArea', enabled: true, workUnitPrice: 900, materialPriceType: 'per_unit', materialPrice: 0, isCustom: true },
    { id: 'doorInstall', name: 'Установка дверей', unit: 'шт', calculationType: 'customCount', enabled: true, workUnitPrice: 4500, materialPriceType: 'total', materialPrice: 15000, count: 1, isCustom: true },
    { id: 'electrical', name: 'Электрика', unit: 'точек', calculationType: 'customCount', enabled: true, workUnitPrice: 300, materialPriceType: 'total', materialPrice: 4000, count: 6, isCustom: true },
  ]
});

function calculateRoomMetrics(room: RoomData) {
  const floorArea = room.length * room.width;
  const perimeter = (room.length + room.width) * 2;
  const grossWallArea = perimeter * room.height;
  
  const windowsArea = room.windows.reduce((sum, w) => sum + w.width * w.height, 0);
  const doorsArea = room.doors.reduce((sum, d) => sum + d.width * d.height, 0);
  const doorsWidth = room.doors.reduce((sum, d) => sum + d.width, 0);
  
  const netWallArea = Math.max(0, grossWallArea - windowsArea - doorsArea);
  const skirtingLength = Math.max(0, perimeter - doorsWidth);

  return {
    floorArea,
    perimeter,
    grossWallArea,
    windowsArea,
    doorsArea,
    netWallArea,
    skirtingLength
  };
}

function calculateRoomCosts(room: RoomData) {
  const metrics = calculateRoomMetrics(room);
  
  const costs: Record<string, { work: number, material: number, total: number }> = {};

  let totalWork = 0;
  let totalMaterial = 0;

  room.works.forEach(work => {
    if (!work.enabled) {
      costs[work.id] = { work: 0, material: 0, total: 0 };
      return;
    }
    
    let qty = 0;
    if (work.calculationType === 'floorArea') qty = metrics.floorArea;
    else if (work.calculationType === 'netWallArea') qty = metrics.netWallArea;
    else if (work.calculationType === 'skirtingLength') qty = metrics.skirtingLength;
    else if (work.calculationType === 'customCount') qty = work.count || 0;

    const wCost = qty * work.workUnitPrice;
    const mCost = work.materialPriceType === 'per_unit' ? qty * work.materialPrice : work.materialPrice;
    costs[work.id] = { work: wCost, material: mCost, total: wCost + mCost };
    totalWork += wCost;
    totalMaterial += mCost;
  });

  return { costs, totalWork, totalMaterial, total: totalWork + totalMaterial };
}

function NumberInput({ value, onChange, className = '', min = 0, step = 1 }: any) {
  const [str, setStr] = useState(value.toString());

  useEffect(() => {
    if (parseFloat(str) !== value && str !== '' && str !== '-') {
      setStr(value.toString());
    }
  }, [value, str]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStr(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (val === '') {
      onChange(0);
    }
  };

  return (
    <input 
      type="number" 
      min={min} 
      step={step} 
      value={str} 
      onChange={handleChange} 
      className={`px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${className}`} 
    />
  );
}

function SummaryView({ project, updateProject, deleteProject }: { project: ProjectData, updateProject: (p: ProjectData) => void, deleteProject: () => void }) {
  let totalFloorArea = 0;
  let totalWallArea = 0;
  let totalWorkCost = 0;
  let totalMaterialCost = 0;

  project.rooms.forEach(r => {
    const metrics = calculateRoomMetrics(r);
    const costs = calculateRoomCosts(r);
    totalFloorArea += metrics.floorArea;
    totalWallArea += metrics.netWallArea;
    totalWorkCost += costs.totalWork;
    totalMaterialCost += costs.totalMaterial;
  });

  const grandTotal = totalWorkCost + totalMaterialCost;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <input 
          className="text-3xl font-light text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full max-w-md"
          value={project.name}
          onChange={e => updateProject({...project, name: e.target.value})}
          placeholder="Название объекта"
        />
        <button onClick={deleteProject} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0" title="Удалить объект">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Площадь по полу</div>
          <div className="text-3xl font-light">{totalFloorArea.toFixed(2)} <span className="text-lg text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Площадь стен (под обои)</div>
          <div className="text-3xl font-light">{totalWallArea.toFixed(2)} <span className="text-lg text-gray-400">м²</span></div>
        </div>
        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-md">
          <div className="text-indigo-100 text-sm mb-1">Итоговая стоимость</div>
          <div className="text-3xl font-semibold">{grandTotal.toLocaleString('ru-RU')} <span className="text-indigo-200 text-lg">₽</span></div>
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
                  <h4 className="font-medium text-lg">{room.name}</h4>
                  <div className="text-sm text-gray-500 mt-1">
                    Работы: {costs.totalWork.toLocaleString('ru-RU')} ₽ • Материалы: {costs.totalMaterial.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                <div className="text-2xl font-light">
                  {costs.total.toLocaleString('ru-RU')} ₽
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

function RoomEditor({ room, updateRoom, deleteRoom }: { room: RoomData, updateRoom: (r: RoomData) => void, deleteRoom: () => void }) {
  const metrics = calculateRoomMetrics(room);
  const { costs, total } = calculateRoomCosts(room);

  const handleWorkChange = (id: string, field: keyof WorkData, value: any) => {
    updateRoom({
      ...room,
      works: room.works.map(w => w.id === id ? { ...w, [field]: value } : w)
    });
  };

  const addCustomWork = () => {
    const newWork: WorkData = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Новая работа',
      unit: 'м²',
      enabled: true,
      workUnitPrice: 0,
      materialPriceType: 'total',
      materialPrice: 0,
      calculationType: 'floorArea',
      isCustom: true
    };
    updateRoom({
      ...room,
      works: [...room.works, newWork]
    });
  };

  const removeWork = (id: string) => {
    updateRoom({
      ...room,
      works: room.works.filter(w => w.id !== id)
    });
  };

  const addWindow = () => updateRoom({...room, windows: [...room.windows, { id: Math.random().toString(), width: 1.5, height: 1.5 }]});
  const removeWindow = (id: string) => updateRoom({...room, windows: room.windows.filter(w => w.id !== id)});
  const updateWindow = (id: string, field: keyof Opening, val: number) => updateRoom({...room, windows: room.windows.map(w => w.id === id ? { ...w, [field]: val } : w)});

  const addDoor = () => updateRoom({...room, doors: [...room.doors, { id: Math.random().toString(), width: 0.9, height: 2.0 }]});
  const removeDoor = (id: string) => updateRoom({...room, doors: room.doors.filter(d => d.id !== id)});
  const updateDoor = (id: string, field: keyof Opening, val: number) => updateRoom({...room, doors: room.doors.map(d => d.id === id ? { ...d, [field]: val } : d)});

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <input 
          className="text-2xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full max-w-md"
          value={room.name}
          onChange={e => updateRoom({...room, name: e.target.value})}
        />
        <button onClick={deleteRoom} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Удалить комнату">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Площадь по полу</div>
          <div className="text-2xl font-light">{metrics.floorArea.toFixed(2)} <span className="text-base text-gray-400">м²</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Площадь стен (под обои)</div>
          <div className="text-2xl font-light">{metrics.netWallArea.toFixed(2)} <span className="text-base text-gray-400">м²</span></div>
        </div>
        <div className="bg-indigo-50 p-6 rounded-2xl shadow-sm border border-indigo-100">
          <div className="text-sm text-indigo-600 mb-1">Итого по комнате</div>
          <div className="text-2xl font-semibold text-indigo-900">{total.toLocaleString('ru-RU')} <span className="text-base text-indigo-400">₽</span></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-medium mb-4">Габариты комнаты</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Длина (м)</label>
            <NumberInput value={room.length} onChange={(v: number) => updateRoom({...room, length: v})} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Ширина (м)</label>
            <NumberInput value={room.width} onChange={(v: number) => updateRoom({...room, width: v})} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Высота (м)</label>
            <NumberInput value={room.height} onChange={(v: number) => updateRoom({...room, height: v})} className="w-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Окна</h3>
            <button onClick={addWindow} className="text-indigo-600 text-sm font-medium hover:text-indigo-700">+ Добавить</button>
          </div>
          {room.windows.length === 0 ? (
            <div className="text-sm text-gray-400 italic">Нет окон</div>
          ) : (
            <div className="space-y-3">
              {room.windows.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                  <NumberInput value={w.width} onChange={(v: number) => updateWindow(w.id, 'width', v)} className="w-20" />
                  <span className="text-gray-400">×</span>
                  <NumberInput value={w.height} onChange={(v: number) => updateWindow(w.id, 'height', v)} className="w-20" />
                  <button onClick={() => removeWindow(w.id)} className="p-1 text-gray-400 hover:text-red-500 ml-auto">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Двери</h3>
            <button onClick={addDoor} className="text-indigo-600 text-sm font-medium hover:text-indigo-700">+ Добавить</button>
          </div>
          {room.doors.length === 0 ? (
            <div className="text-sm text-gray-400 italic">Нет дверей</div>
          ) : (
            <div className="space-y-3">
              {room.doors.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                  <NumberInput value={d.width} onChange={(v: number) => updateDoor(d.id, 'width', v)} className="w-20" />
                  <span className="text-gray-400">×</span>
                  <NumberInput value={d.height} onChange={(v: number) => updateDoor(d.id, 'height', v)} className="w-20" />
                  <button onClick={() => removeDoor(d.id)} className="p-1 text-gray-400 hover:text-red-500 ml-auto">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Работы и материалы</h3>
        </div>
        <div className="space-y-4 mb-6">
          {room.works.map((work) => {
            let qty = 0;
            if (work.calculationType === 'floorArea') qty = metrics.floorArea;
            else if (work.calculationType === 'netWallArea') qty = metrics.netWallArea;
            else if (work.calculationType === 'skirtingLength') qty = metrics.skirtingLength;
            else if (work.calculationType === 'customCount') qty = work.count || 0;
            
            const cost = costs[work.id] || { total: 0 };

            return (
              <div key={work.id} className={`p-4 rounded-xl border transition-colors ${work.enabled ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <input 
                      type="checkbox" 
                      checked={work.enabled} 
                      onChange={e => handleWorkChange(work.id, 'enabled', e.target.checked)} 
                      className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
                    />
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Settings2 className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <input 
                        value={work.name} 
                        onChange={e => handleWorkChange(work.id, 'name', e.target.value)} 
                        className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full"
                        placeholder="Название работы"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-semibold text-indigo-900">{cost.total.toLocaleString('ru-RU')} ₽</div>
                    <button onClick={() => removeWork(work.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {work.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 pl-8">
                    <div className="lg:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Расчет по</label>
                      <select 
                        value={work.calculationType} 
                        onChange={e => {
                          const val = e.target.value as CalculationType;
                          handleWorkChange(work.id, 'calculationType', val);
                          handleWorkChange(work.id, 'unit', val === 'floorArea' || val === 'netWallArea' ? 'м²' : val === 'skirtingLength' ? 'пог. м' : 'шт');
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="floorArea">Площади пола</option>
                        <option value="netWallArea">Площади стен</option>
                        <option value="skirtingLength">Периметру</option>
                        <option value="customCount">Вручную (шт)</option>
                      </select>
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Объем ({work.unit})</label>
                      {work.calculationType === 'customCount' ? (
                        <NumberInput value={work.count || 0} onChange={(v: number) => handleWorkChange(work.id, 'count', v)} className="w-full" />
                      ) : (
                        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 font-mono text-sm">
                          {qty.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Цена работы (за ед.)</label>
                      <div className="relative">
                        <NumberInput value={work.workUnitPrice} onChange={(v: number) => handleWorkChange(work.id, 'workUnitPrice', v)} className="w-full pr-8" />
                        <span className="absolute right-3 top-2 text-gray-400 text-sm">₽</span>
                      </div>
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Тип цены материалов</label>
                      <select 
                        value={work.materialPriceType} 
                        onChange={e => handleWorkChange(work.id, 'materialPriceType', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="total">За весь объем</option>
                        <option value="per_unit">За единицу</option>
                      </select>
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Цена материалов</label>
                      <div className="relative">
                        <NumberInput value={work.materialPrice} onChange={(v: number) => handleWorkChange(work.id, 'materialPrice', v)} className="w-full pr-8" />
                        <span className="absolute right-3 top-2 text-gray-400 text-sm">₽</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button 
          onClick={addCustomWork} 
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all"
        >
          <Plus className="w-5 h-5" />
          Добавить работу
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    updateProjects,
    updateActiveProject,
    isLoading,
    lastSaved,
    saveError
  } = useProjects(initialProjects);
  
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Показываем загрузку
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Загрузка проектов...</p>
        </div>
      </div>
    );
  }

  const handleDeleteActiveProject = () => {
    if (projects.length === 1) {
      const newProject = createNewProject();
      updateProjects([newProject]);
      setActiveProjectId(newProject.id);
    } else {
      const newProjects = projects.filter(p => p.id !== activeProjectId);
      updateProjects(newProjects);
      setActiveProjectId(newProjects[0].id);
    }
    setActiveTab('summary');
  };

  const handleImport = (importedProjects: ProjectData[], importedActiveId: string) => {
    updateProjects(importedProjects);
    setActiveProjectId(importedActiveId);
    setActiveTab('summary');
  };

  const handleClearAll = () => {
    StorageManager.clearAll();
    const newProject = createNewProject();
    updateProjects([newProject]);
    setActiveProjectId(newProject.id);
    setActiveTab('summary');
  };



  const updateRoomInProject = (updatedRoom: RoomData) => {
    const updatedProject = {
      ...activeProject,
      rooms: activeProject.rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r)
    };
    updateActiveProject(updatedProject);
  };

  const deleteRoomFromProject = (roomId: string) => {
    const newRooms = activeProject.rooms.filter(r => r.id !== roomId);
    const updatedProject = {
      ...activeProject,
      rooms: newRooms
    };
    updateActiveProject(updatedProject);
    setActiveTab(newRooms.length > 0 ? newRooms[0].id : 'summary');
  };

  const addRoomToProject = () => {
    const newRoom = createNewRoom();
    const updatedProject = {
      ...activeProject,
      rooms: [...activeProject.rooms, newRoom]
    };
    updateActiveProject(updatedProject);
    setActiveTab(newRoom.id);
    setIsMobileMenuOpen(false);
  };

  const addNewProject = () => {
    const newProject = createNewProject();
    updateProjects([...projects, newProject]);
    setActiveProjectId(newProject.id);
    setActiveTab('summary');
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col md:flex-row font-sans text-gray-900">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-600">
            <Calculator className="w-6 h-6" />
            <span className="font-semibold text-lg">Ремонт-Кальк</span>
          </div>
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Объект</label>
          <select 
            value={activeProjectId}
            onChange={(e) => {
              setActiveProjectId(e.target.value);
              setActiveTab('summary');
              setIsMobileMenuOpen(false);
            }}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 truncate"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Обзор</div>
          <button 
            onClick={() => { setActiveTab('summary'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors ${activeTab === 'summary' ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Общая смета</span>
          </button>

          <div className="px-4 mt-6 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Комнаты</div>
          {activeProject.rooms.map(room => (
            <button 
              key={room.id}
              onClick={() => { setActiveTab(room.id); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-6 py-3 text-left transition-colors ${activeTab === room.id ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span className="truncate pr-2">{room.name}</span>
              <ChevronRight className={`w-4 h-4 ${activeTab === room.id ? 'text-indigo-600' : 'text-gray-400'}`} />
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <button 
            onClick={addRoomToProject}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить комнату
          </button>
          <button 
            onClick={addNewProject} 
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all"
          >
            <Plus className="w-4 h-4" /> 
            Новый объект
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <span className="font-semibold text-lg truncate flex-1">
            {activeTab === 'summary' ? activeProject.name : activeProject.rooms.find(r => r.id === activeTab)?.name}
          </span>
          <BackupManager 
            projects={projects}
            activeProjectId={activeProjectId}
            onImport={handleImport}
            onClearAll={handleClearAll}
          />
        </header>

        {/* Desktop header with backup manager */}
        <header className="hidden md:flex bg-white border-b border-gray-200 p-4 items-center justify-between">
          <div className="flex items-center gap-2">
            {lastSaved && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Save className="w-3 h-3" />
                <span>Сохранено {lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {saveError && (
              <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {saveError}
              </div>
            )}
          </div>
          <BackupManager 
            projects={projects}
            activeProjectId={activeProjectId}
            onImport={handleImport}
            onClearAll={handleClearAll}
          />
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {activeTab === 'summary' ? (
              <SummaryView 
                project={activeProject} 
                updateProject={updateActiveProject} 
                deleteProject={handleDeleteActiveProject} 
              />
            ) : (
              activeProject.rooms.find(r => r.id === activeTab) && (
                <RoomEditor 
                  room={activeProject.rooms.find(r => r.id === activeTab)!} 
                  updateRoom={updateRoomInProject}
                  deleteRoom={() => deleteRoomFromProject(activeTab)}
                />
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
