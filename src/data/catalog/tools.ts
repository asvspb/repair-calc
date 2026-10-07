// ============================================
// ИНСТРУМЕНТЫ (переиспользуемые)
// ============================================

import type { ToolTemplate } from '../../types/workTemplate';

export const TOOLS = {
  // Пол
  подбойка: {
    id: 'tool-podboyka',
    name: 'Подбойка для ламината',
    isRentDefault: false,
    defaultPrice: 500,
  } as ToolTemplate,
  клинья: {
    id: 'tool-wedges',
    name: 'Клинья распорные',
    isRentDefault: false,
    defaultPrice: 150,
  } as ToolTemplate,
  лобзик: {
    id: 'tool-jigsaw',
    name: 'Электролобзик',
    isRentDefault: true,
    defaultPrice: 500,
    defaultRentPeriod: 1,
  } as ToolTemplate,
  плиткорез: {
    id: 'tool-tile-cutter',
    name: 'Плиткорез',
    isRentDefault: true,
    defaultPrice: 800,
    defaultRentPeriod: 1,
  } as ToolTemplate,
  шпательЗубчатый: {
    id: 'tool-notched-trowel',
    name: 'Шпатель зубчатый',
    isRentDefault: false,
    defaultPrice: 300,
  } as ToolTemplate,
  тёрка: {
    id: 'tool-grout-float',
    name: 'Тёрка резиновая',
    isRentDefault: false,
    defaultPrice: 250,
  } as ToolTemplate,
  миксер: {
    id: 'tool-mixer',
    name: 'Миксер (насадка)',
    isRentDefault: false,
    defaultPrice: 400,
  } as ToolTemplate,
  правилоНаливной: {
    id: 'tool-screed-rule',
    name: 'Правило',
    isRentDefault: false,
    defaultPrice: 800,
  } as ToolTemplate,
  валикИгольчатый: {
    id: 'tool-needle-roller',
    name: 'Валик игольчатый',
    isRentDefault: false,
    defaultPrice: 350,
  } as ToolTemplate,
  ножЛинолеум: {
    id: 'tool-linoleum-knife',
    name: 'Нож для линолеума',
    isRentDefault: false,
    defaultPrice: 300,
  } as ToolTemplate,
  шпательЛинолеум: {
    id: 'tool-linoleum-trowel',
    name: 'Шпатель для клея',
    isRentDefault: false,
    defaultPrice: 250,
  } as ToolTemplate,

  // Стены
  валикОбойный: {
    id: 'tool-wallpaper-roller',
    name: 'Валик обойный',
    isRentDefault: false,
    defaultPrice: 200,
  } as ToolTemplate,
  кистьОбойная: {
    id: 'tool-wallpaper-brush',
    name: 'Кисть для клея',
    isRentDefault: false,
    defaultPrice: 150,
  } as ToolTemplate,
  ножОбойный: {
    id: 'tool-wallpaper-knife',
    name: 'Нож обойный',
    isRentDefault: false,
    defaultPrice: 200,
  } as ToolTemplate,
  валикМалярный: {
    id: 'tool-paint-roller',
    name: 'Валик малярный',
    isRentDefault: false,
    defaultPrice: 300,
  } as ToolTemplate,
  кистьМалярная: {
    id: 'tool-paint-brush',
    name: 'Кисть малярная',
    isRentDefault: false,
    defaultPrice: 150,
  } as ToolTemplate,
  ванночкаКраски: {
    id: 'tool-paint-tray',
    name: 'Ванночка для краски',
    isRentDefault: false,
    defaultPrice: 150,
  } as ToolTemplate,
  скотчМалярный: {
    id: 'tool-painters-tape',
    name: 'Скотч малярный',
    isRentDefault: false,
    defaultPrice: 100,
  } as ToolTemplate,
  правилоШтукатурка: {
    id: 'tool-plaster-rule',
    name: 'Правило алюминиевое',
    isRentDefault: false,
    defaultPrice: 1200,
  } as ToolTemplate,
  шпатели: {
    id: 'tool-spacles',
    name: 'Набор шпателей',
    isRentDefault: false,
    defaultPrice: 600,
  } as ToolTemplate,
  тёркаШпаклёвка: {
    id: 'tool-putty-float',
    name: 'Тёрка шлифовальная',
    isRentDefault: false,
    defaultPrice: 300,
  } as ToolTemplate,
  шуруповёрт: {
    id: 'tool-screwdriver',
    name: 'Шуруповёрт',
    isRentDefault: true,
    defaultPrice: 400,
    defaultRentPeriod: 1,
  } as ToolTemplate,
  уровень: {
    id: 'tool-level',
    name: 'Уровень пузырьковый',
    isRentDefault: false,
    defaultPrice: 500,
  } as ToolTemplate,
  ножовка: {
    id: 'tool-handsaw',
    name: 'Ножовка',
    isRentDefault: false,
    defaultPrice: 400,
  } as ToolTemplate,

  // Потолок
  валикСУдлинителем: {
    id: 'tool-ceiling-roller',
    name: 'Валик с удлинителем',
    isRentDefault: false,
    defaultPrice: 600,
  } as ToolTemplate,
  ножницыПоМеталлу: {
    id: 'tool-metal-shears',
    name: 'Ножницы по металлу',
    isRentDefault: false,
    defaultPrice: 600,
  } as ToolTemplate,

  // Проёмы
  пила: { id: 'tool-saw', name: 'Пила', isRentDefault: false, defaultPrice: 500 } as ToolTemplate,
  монтажнаяПена: {
    id: 'tool-foam-gun',
    name: 'Пистолет для пены',
    isRentDefault: false,
    defaultPrice: 400,
  } as ToolTemplate,

  // Демонтаж
  перфоратор: {
    id: 'tool-demolition-hammer',
    name: 'Перфоратор',
    isRentDefault: true,
    defaultPrice: 1000,
    defaultRentPeriod: 1,
  } as ToolTemplate,
  лом: { id: 'tool-crowbar', name: 'Лом', isRentDefault: false, defaultPrice: 400 } as ToolTemplate,
  молоток: {
    id: 'tool-hammer',
    name: 'Молоток',
    isRentDefault: false,
    defaultPrice: 300,
  } as ToolTemplate,

  // Электрика/Сантехника
  тестер: {
    id: 'tool-tester',
    name: 'Тестер (мультиметр)',
    isRentDefault: false,
    defaultPrice: 500,
  } as ToolTemplate,
  трубогиб: {
    id: 'tool-pipe-bender',
    name: 'Трубогиб',
    isRentDefault: true,
    defaultPrice: 400,
    defaultRentPeriod: 1,
  } as ToolTemplate,
  паяльникДляТруб: {
    id: 'tool-pipe-welder',
    name: 'Паяльник для труб',
    isRentDefault: true,
    defaultPrice: 500,
    defaultRentPeriod: 1,
  } as ToolTemplate,
  ключи: {
    id: 'tool-wrenches',
    name: 'Набор ключей',
    isRentDefault: false,
    defaultPrice: 1500,
  } as ToolTemplate,
};
