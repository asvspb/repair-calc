# Техническое задание: Исправление бага сброса данных в Расширенном режиме

## Дата составления
07.03.2026

---

## 1. Описание проблемы



### 1.1 Сценарий воспроизведения бага

| Шаг | Действие | Ожидаемый результат | Фактический результат |
|-----|----------|---------------------|----------------------|
| 1 | Перейти в раздел "Габариты помещения" | Отображается блок геометрии | ✅ Корректно |
| 2 | Выбрать режим "Расширенный" | Активен расширенный режим | ✅ Корректно |
| 3 | Добавить новую секцию | Секция создана | ✅ Корректно |
| 4 | Выбрать геометрическую фигуру (трапеция/треугольник/параллелограмм) | Фигура выбрана, отображаются соответствующие поля | ✅ Корректно |
| 5 | Ввести значение в поле "Высота (м)" | Высота установлена | ✅ Корректно |
| 6 | Секция удаляется (автоматически или пользователем) | Секция удалена | ⚠️ Происходит автоматически |
| 7 | Режим переключается на "Простой" | Переключение в простой режим | ✅ Происходит |
| 8 | Проверка сохранённых значений | Данные предыдущего простого режима восстановлены | ❌ **Все значения сброшены на 0** |

### 1.2 Визуальное описание проблемы

```
ДО (в простом режиме):
┌─────────────────────────────────────┐
│  Длина: 5.0 м                       │
│  Ширина: 4.0 м                      │
│  Высота: 2.7 м                      │
│  Окна: [2 окна]                     │
│  Двери: [1 дверь]                   │
└─────────────────────────────────────┘

ПОСЛЕ (переключение расширенный → простой):
┌─────────────────────────────────────┐
│  Длина: 0 м          ← СБРОШЕНО    │
│  Ширина: 0 м         ← СБРОШЕНО    │
│  Высота: 0 м         ← СБРОШЕНО    │
│  Окна: []            ← СБРОШЕНО    │
│  Двери: []           ← СБРОШЕНО    │
└─────────────────────────────────────┘
```

---

## 2. Анализ кода

### 2.1 Задействованные файлы

| Файл | Назначение |
|------|------------|
| `src/hooks/useGeometryState.ts` | Основной хук управления состоянием геометрии, содержит логику переключения режимов |
| `src/components/geometry/GeometrySection.tsx` | Компонент секции геометрии, отображает UI |
| `src/components/geometry/ModeSelector.tsx` | Селектор режимов (Простой/Расширенный/Профессиональный) |
| `src/components/geometry/ExtendedGeometry.tsx` | Компонент расширенной геометрии (секции) |
| `src/components/geometry/SubSectionItem.tsx` | Компонент отдельной секции с полями ввода |
| `src/types/index.ts` | TypeScript типы данных |

### 2.2 Логика переключения режимов

Текущая реализация в `useGeometryState.ts` (функция `handleGeometryModeChange`):

```typescript
// 1. Сохранение текущих данных перед переключением
if (room.geometryMode === 'simple') {
  updatedRoom.simpleModeData = { ... };
} else if (room.geometryMode === 'extended') {
  updatedRoom.extendedModeData = { ... };
}

// 2. Восстановление данных целевого режима
if (newMode === 'simple') {
  if (updatedRoom.simpleModeData) {
    // Восстановление из simpleModeData
  } else {
    // Инициализация пустыми значениями ← ПРОБЛЕМА!
    updatedRoom = {
      ...updatedRoom,
      length: 0,
      width: 0,
      windows: [],
      doors: []
    };
  }
}
```

### 2.3 Предполагаемая причина бага

При удалении последней секции в расширенном режиме или при определённых условиях:

1. **Возможная причина A**: `simpleModeData` перезаписывается пустыми значениями при каком-то промежуточном обновлении состояния
2. **Возможная причина B**: При удалении секции срабатывает эффект, который очищает `simpleModeData`
3. **Возможная причина C**: Проблема с синхронизацией `sessionStorage` и состояния React
4. **Возможная причина D**: При изменении высоты в расширенном режиме происходит конфликт обновлений

---

## 3. Требования к исправлению

### 3.1 Функциональные требования

#### FR-1: Сохранение данных простого режима
При переключении из простого режима в расширенный, данные простого режима должны сохраняться в `simpleModeData` и не должны изменяться до следующего входа в простой режим.

#### FR-2: Восстановление данных простого режима
При переключении из расширенного режима обратно в простой:
- Если есть сохранённые данные в `simpleModeData` — восстановить их
- Если данных нет (первый вход) — инициализировать значениями по умолчанию

#### FR-3: Независимость высоты
Поле "Высота" является общим для всех режимов и должно сохраняться при переключении режимов.

#### FR-4: Стабильность при удалении секций
Удаление секций в расширенном режиме не должно влиять на сохранённые данные простого режима.

### 3.2 Нефункциональные требования

#### NFR-1: Производительность
Исправление не должно увеличивать время переключения режимов более чем на 50мс.

#### NFR-2: Обратная совместимость
Исправление должно корректно работать с существующими сохранёнными данными в `localStorage`.

#### NFR-3: Тестируемость
Логика переключения режимов должна быть покрыта unit-тестами.

---

## 4. План реализации

### 4.1 Этап 1: Диагностика (Приоритет: Высокий)

**Задачи:**
1. Добавить логирование в `handleGeometryModeChange` для отслеживания:
   - Значения `simpleModeData` перед сохранением
   - Значения `simpleModeData` при восстановлении
   - Моменты вызова функции обновления

2. Добавить логирование в `updateRoom` и `updateRoomById` для отслеживания цепочки вызовов

3. Проверить, не перезаписывается ли `simpleModeData` в:
   - `addSubSection`
   - `removeSubSection`
   - `updateSubSection`
   - Эффектах `useGeometryState`

**Ожидаемый результат:** Определена точная причина бага

### 4.2 Этап 2: Исправление (Приоритет: Высокий)

**Варианты решений:**

#### Вариант A: Защита от перезаписи (рекомендуется)
```typescript
// В handleGeometryModeChange
if (room.geometryMode === 'simple') {
  // Сохранять только если данные не пустые
  const hasData = room.length > 0 || room.width > 0 || room.windows.length > 0;
  if (hasData) {
    updatedRoom.simpleModeData = { ... };
  }
}
```

#### Вариант B: Отложенное сохранение
Сохранять `simpleModeData` только при явном выходе из простого режима, а не при каждом обновлении.

#### Вариант C: Иммутабельность
Использовать `useRef` или отдельное хранилище для `simpleModeData`, чтобы исключить случайные перезаписи.

**Решение:** Выбрать оптимальный вариант после диагностики

### 4.3 Этап 3: Рефакторинг (Приоритет: Средний) — Вариант D (рекомендуется)

#### Анализ корневой причины

После глубокого анализа кода выявлена **истинная причина бага** — проблема "stale closure" в `handleGeometryModeChange`:

```typescript
// Текущая реализация в useGeometryState.ts (строка ~80)
const handleGeometryModeChange = useCallback((newMode: GeometryMode) => {
  if (room.geometryMode === newMode) return;  // ← room из замыкания

  let updatedRoom: RoomData = {
    ...room,  // ← STALE CLOSURE: room может быть устаревшим!
    geometryMode: newMode
  };
  // ...
  updateRoom(updatedRoom);  // ← Прямое обновление, не функциональное
}, [room, updateRoom]);  // ← Зависимость от всего объекта room
```

**Почему это вызывает баг:**

1. При быстром переключении режимов `room` в замыкании `useCallback` ссылается на состояние, которое было актуально на момент последнего рендера
2. Если между рендерами произошли изменения (например, обновление высоты через `updateRoom({ ...room, height: v })`), эти изменения теряются
3. `simpleModeData` перезаписывается старым значением (или отсутствующим)

**Дополнительная проблема в GeometrySection.tsx (строка 96):**

```typescript
onChange={(v: number) => updateRoom({ ...room, height: v })}
```

Та же проблема — `room` из замыкания может быть устаревшим при быстрых обновлениях.

#### Предлагаемое решение: Функциональное обновление

Изменить `handleGeometryModeChange` для использования `updateRoomById` вместо `updateRoom`:

```typescript
const handleGeometryModeChange = useCallback((newMode: GeometryMode) => {
  updateRoomById(room.id, prevRoom => {
    // Выход, если режим не изменился
    if (prevRoom.geometryMode === newMode) return prevRoom;

    let updatedRoom: RoomData = {
      ...prevRoom,  // ← Актуальное состояние из функционального обновления!
      geometryMode: newMode
    };

    // Сохранение данных текущего режима (только если есть данные)
    if (prevRoom.geometryMode === 'simple') {
      const hasSimpleData = prevRoom.length > 0 || prevRoom.width > 0 || 
                           prevRoom.windows.length > 0 || prevRoom.doors.length > 0;
      // Сохраняем только если есть данные ИЛИ simpleModeData ещё не был установлен
      if (hasSimpleData || !prevRoom.simpleModeData) {
        updatedRoom.simpleModeData = {
          length: prevRoom.length,
          width: prevRoom.width,
          windows: prevRoom.windows.map(w => ({ ...w })),
          doors: prevRoom.doors.map(d => ({ ...d }))
        };
      }
    } else if (prevRoom.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        subSections: prevRoom.subSections.map(s => ({
          ...s,
          windows: (s.windows || []).map(w => ({ ...w })),
          doors: (s.doors || []).map(d => ({ ...d }))
        }))
      };
    } else if (prevRoom.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        segments: prevRoom.segments.map(s => ({ ...s })),
        obstacles: prevRoom.obstacles.map(o => ({ ...o })),
        wallSections: prevRoom.wallSections.map(ws => ({ ...ws }))
      };
    }

    // Восстановление данных целевого режима
    if (newMode === 'simple') {
      if (updatedRoom.simpleModeData) {
        updatedRoom = {
          ...updatedRoom,
          length: updatedRoom.simpleModeData.length,
          width: updatedRoom.simpleModeData.width,
          windows: updatedRoom.simpleModeData.windows.map(w => ({ ...w })),
          doors: updatedRoom.simpleModeData.doors.map(d => ({ ...d }))
        };
      } else {
        updatedRoom = {
          ...updatedRoom,
          length: 0,
          width: 0,
          windows: [],
          doors: []
        };
      }
    } else if (newMode === 'extended') {
      if (updatedRoom.extendedModeData) {
        updatedRoom = {
          ...updatedRoom,
          subSections: updatedRoom.extendedModeData.subSections.map(s => ({
            ...s,
            windows: (s.windows || []).map(w => ({ ...w })),
            doors: (s.doors || []).map(d => ({ ...d }))
          }))
        };
      } else {
        updatedRoom = {
          ...updatedRoom,
          subSections: []
        };
      }
    } else if (newMode === 'advanced') {
      if (updatedRoom.advancedModeData) {
        updatedRoom = {
          ...updatedRoom,
          segments: updatedRoom.advancedModeData.segments.map(s => ({ ...s })),
          obstacles: updatedRoom.advancedModeData.obstacles.map(o => ({ ...o })),
          wallSections: updatedRoom.advancedModeData.wallSections.map(ws => ({ ...ws }))
        };
      } else {
        updatedRoom = {
          ...updatedRoom,
          segments: [],
          obstacles: [],
          wallSections: []
        };
      }
    }

    return updatedRoom;
  });
}, [room.id, updateRoomById]);  // ← Зависимость только от id, а не от всего объекта!
```

#### Дополнительное исправление в GeometrySection.tsx

Заменить прямое обновление на функциональное (строка ~96):

```typescript
// Было:
onChange={(v: number) => updateRoom({ ...room, height: v })}

// Станет:
onChange={(v: number) => updateRoomById(room.id, prev => ({ ...prev, height: v }))}
```

#### Преимущества решения

| Аспект | Преимущество |
|--------|--------------|
| **Надёжность** | Функциональное обновление гарантирует работу с актуальным состоянием |
| **Производительность** | Меньше зависимостей в `useCallback` = меньше перерендеров |
| **Минимальность** | Изменения затрагивают только 2 файла |
| **Совместимость** | Обратная совместимость с существующими данными localStorage |

#### Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/hooks/useGeometryState.ts` | Рефакторинг `handleGeometryModeChange` |
| `src/components/geometry/GeometrySection.tsx` | Исправление обновления высоты |


**Задачи:**
1. Вынести логику сохранения/восстановления в отдельные чистые функции
2. Добавить типизацию для режимов данных
3. Унифицировать подход для всех трёх режимов (simple, extended, advanced)

### 4.4 Этап 4: Тестирование (Приоритет: Высокий)

**Тест-кейсы:**

| ID | Сценарий | Ожидаемый результат |
|----|----------|---------------------|
| TC-1 | Простой → Расширенный → Простой | Данные простого режима сохранены |
| TC-2 | Простой → Расширенный (добавить секцию) → Простой | Данные простого режима сохранены |
| TC-3 | Простой → Расширенный (выбрать фигуру) → Простой | Данные простого режима сохранены |
| TC-4 | Простой → Расширенный (ввести высоту) → Простой | Данные простого режима сохранены, высота обновлена |
| TC-5 | Простой → Расширенный (удалить секцию) → Простой | Данные простого режима сохранены |
| TC-6 | Простой → Профессиональный → Простой | Данные простого режима сохранены |
| TC-7 | Перезагрузка страницы после TC-1 | Данные восстановлены из localStorage |

---

## 5. Критерии приёмки

### 5.1 Обязательные критерии

- [ ] Баг не воспроизводится по шагам из раздела 1.1
- [ ] Все тест-кейсы из раздела 4.4 пройдены
- [ ] Существующие unit-тесты не сломаны
- [ ] TypeScript проверка проходит без ошибок (`npm run lint`)

### 5.2 Желательные критерии

- [ ] Покрытие кода тестами увеличено на 10%
- [ ] Добавлена документация по работе с режимами геометрии

---

## 6. Связанные документы

- `docs/ARCHITECTURE.md` — архитектура приложения
- `docs/REFACTORING_GEOMETRY_BLOCK.md` — предыдущий рефакторинг геометрии
- `src/hooks/useGeometryState.ts` — основной хук
- `src/types/index.ts` — типы данных

---

## 7. История изменений

| Дата | Версия | Автор | Изменения |
|------|--------|-------|-----------|
| 07.03.2026 | 1.0 | AI Assistant | Первоначальное составление ТЗ |

---

## 8. Приложения

### 8.1 Структура данных RoomData (релевантные поля)

```typescript
interface RoomData {
  id: string;
  name: string;
  
  // Текущий режим
  geometryMode: 'simple' | 'extended' | 'advanced';
  
  // Общие поля
  height: number;
  
  // Простой режим
  length: number;
  width: number;
  windows: Opening[];
  doors: Opening[];
  
  // Расширенный режим
  subSections: RoomSubSection[];
  
  // Профессиональный режим
  segments: RoomSegment[];
  obstacles: Obstacle[];
  wallSections: WallSection[];
  
  // Сохранённые данные режимов
  simpleModeData?: {
    length: number;
    width: number;
    windows: Opening[];
    doors: Opening[];
  };
  
  extendedModeData?: {
    subSections: RoomSubSection[];
  };
  
  advancedModeData?: {
    segments: RoomSegment[];
    obstacles: Obstacle[];
    wallSections: WallSection[];
  };
}
```

### 8.2 Логи для отладки (шаблон)

```typescript
// Добавить в handleGeometryModeChange
console.log('[ModeChange] From:', room.geometryMode, 'To:', newMode);
console.log('[ModeChange] Current simpleModeData:', room.simpleModeData);
console.log('[ModeChange] Current extendedModeData:', room.extendedModeData);

// Добавить перед updateRoom
console.log('[ModeChange] Updated room:', updatedRoom);
console.log('[ModeChange] Will save simpleModeData:', updatedRoom.simpleModeData);
```

---

## 9. Моё решение (AI Analysis)

### 9.1 Корневая причина бага

После анализа кода выявлена **проблема stale closure** в двух местах:

#### Проблема A: `handleGeometryModeChange` (useGeometryState.ts:87)

```typescript
// ТЕКУЩИЙ КОД — ПРОБЛЕМА:
const handleGeometryModeChange = useCallback((newMode: GeometryMode) => {
  if (room.geometryMode === newMode) return;
  
  let updatedRoom: RoomData = {
    ...room,  // ← room из замыкания может быть устаревшим!
    geometryMode: newMode
  };
  // ...
  updateRoom(updatedRoom);  // ← Прямое обновление (не функциональное)
}, [room, updateRoom]);  // ← Зависимость от всего объекта room
```

**Почему это вызывает баг:**

| Шаг | Событие | Состояние room |
|-----|---------|----------------|
| 1 | Пользователь в простом режиме: `length=5, width=4` | `{length: 5, width: 4, ...}` |
| 2 | Переключение в расширенный режим | `room` в замыкании ещё `{length: 5, width: 4, ...}` |
| 3 | **Гонка:** состояние обновляется, но closure не обновился | `room` в замыкании всё ещё старый |
| 4 | `simpleModeData` сохраняется из старого `room` | `{length: 0, width: 0, ...}` ← **БАГ!** |
| 5 | Возврат в простой режим | Данные восстановлены из corrupted `simpleModeData` |

#### Проблема B: Обновление высоты (GeometrySection.tsx:214)

```typescript
// ТЕКУЩИЙ КОД — ПРОБЛЕМА:
onChange={(v: number) => updateRoom({ ...room, height: v })}
```

Та же stale closure проблема — `room` может быть устаревшим.

---

### 9.2 Решение: Функциональные обновления

#### Изменение 1: useGeometryState.ts

```typescript
// НОВЫЙ КОД — РЕШЕНИЕ:
const handleGeometryModeChange = useCallback((newMode: GeometryMode) => {
  updateRoomById(room.id, prevRoom => {
    if (prevRoom.geometryMode === newMode) return prevRoom;

    let updatedRoom: RoomData = {
      ...prevRoom,  // ← Актуальное состояние из функционального обновления
      geometryMode: newMode
    };

    // Сохранение данных текущего режима (только если есть данные)
    if (prevRoom.geometryMode === 'simple') {
      const hasSimpleData = prevRoom.length > 0 || prevRoom.width > 0 ||
                           prevRoom.windows.length > 0 || prevRoom.doors.length > 0;
      if (hasSimpleData || !prevRoom.simpleModeData) {
        updatedRoom.simpleModeData = {
          length: prevRoom.length,
          width: prevRoom.width,
          windows: prevRoom.windows.map(w => ({ ...w })),
          doors: prevRoom.doors.map(d => ({ ...d }))
        };
      }
    } else if (prevRoom.geometryMode === 'extended') {
      updatedRoom.extendedModeData = {
        subSections: prevRoom.subSections.map(s => ({
          ...s,
          windows: (s.windows || []).map(w => ({ ...w })),
          doors: (s.doors || []).map(d => ({ ...d }))
        }))
      };
    } else if (prevRoom.geometryMode === 'advanced') {
      updatedRoom.advancedModeData = {
        segments: prevRoom.segments.map(s => ({ ...s })),
        obstacles: prevRoom.obstacles.map(o => ({ ...o })),
        wallSections: prevRoom.wallSections.map(ws => ({ ...ws }))
      };
    }

    // Восстановление данных целевого режима
    if (newMode === 'simple') {
      if (updatedRoom.simpleModeData) {
        updatedRoom = {
          ...updatedRoom,
          length: updatedRoom.simpleModeData.length,
          width: updatedRoom.simpleModeData.width,
          windows: updatedRoom.simpleModeData.windows.map(w => ({ ...w })),
          doors: updatedRoom.simpleModeData.doors.map(d => ({ ...d }))
        };
      } else {
        updatedRoom = {
          ...updatedRoom,
          length: 0,
          width: 0,
          windows: [],
          doors: []
        };
      }
    } else if (newMode === 'extended') {
      if (updatedRoom.extendedModeData) {
        updatedRoom = {
          ...updatedRoom,
          subSections: updatedRoom.extendedModeData.subSections.map(s => ({
            ...s,
            windows: (s.windows || []).map(w => ({ ...w })),
            doors: (s.doors || []).map(d => ({ ...d }))
          }))
        };
      } else {
        updatedRoom = {
          ...updatedRoom,
          subSections: []
        };
      }
    } else if (newMode === 'advanced') {
      if (updatedRoom.advancedModeData) {
        updatedRoom = {
          ...updatedRoom,
          segments: updatedRoom.advancedModeData.segments.map(s => ({ ...s })),
          obstacles: updatedRoom.advancedModeData.obstacles.map(o => ({ ...o })),
          wallSections: updatedRoom.advancedModeData.wallSections.map(ws => ({ ...ws }))
        };
      } else {
        updatedRoom = {
          ...updatedRoom,
          segments: [],
          obstacles: [],
          wallSections: []
        };
      }
    }

    return updatedRoom;
  });
}, [room.id, updateRoomById]);  // ← Зависимость только от id!
```

**Ключевые изменения:**

| Было | Стало | Преимущество |
|------|-------|--------------|
| `updateRoom(updatedRoom)` | `updateRoomById(room.id, prevRoom => {...})` | Гарантия актуального состояния |
| Зависимость `[room, updateRoom]` | Зависимость `[room.id, updateRoomById]` | Меньше перерендеров |
| `...room` | `...prevRoom` | Работа с актуальными данными |
| Нет защиты от пустых данных | `if (hasSimpleData \|\| !prevRoom.simpleModeData)` | Защита от перезаписи |

#### Изменение 2: GeometrySection.tsx

```typescript
// Было (строка ~214):
onChange={(v: number) => updateRoom({ ...room, height: v })}

// Станет:
onChange={(v: number) => updateRoomById(room.id, prev => ({ ...prev, height: v }))}
```

---

### 9.3 Итоговые изменения

| Файл | Строка | Изменение |
|------|--------|-----------|
| `src/hooks/useGeometryState.ts` | ~87-170 | Полный рефакторинг `handleGeometryModeChange` |
| `src/components/geometry/GeometrySection.tsx` | ~214 | Исправление обновления высоты |

---

### 9.4 Почему это решение правильное

1. **Функциональное обновление** — `updateRoomById(roomId, updaterFn)` гарантирует, что `updaterFn` получит актуальное состояние на момент выполнения, а не на момент рендера

2. **Минимальные зависимости** — `useCallback` зависит только от `room.id` и `updateRoomById`, а не от всего объекта `room`

3. **Защита от пустых данных** — проверка `hasSimpleData` предотвращает сохранение нулевых значений в `simpleModeData`

4. **Обратная совместимость** — решение работает с существующими данными в `localStorage`

---

## 10. История изменений документа

| Дата | Версия | Автор | Изменения |
|------|--------|-------|-----------|
| 07.03.2026 | 1.0 | AI Assistant | Первоначальное составление ТЗ |
| 07.03.2026 | 1.1 | AI Assistant | Добавлено решение (раздел 9) |
