# Техническое задание: Шаблоны работ (Work Templates)

**Дата:** 2026-03-01  
**Статус:** Проектирование  
**Приоритет:** Средний (после Фазы 1–2 из ARCHITECTURE.md)  
**Связанные документы:** [ARCHITECTURE.md](./ARCHITECTURE.md), [CODE_REVIEW.md](./CODE_REVIEW.md)

---

## 1. Бизнес-задача

При ремонте нескольких помещений многие работы повторяются: укладка ламината, шпаклевание стен, монтаж плинтусов и т.д. Каждый раз пользователь заново создаёт работу, вводит цену, добавляет материалы и инструменты. Это трудоёмко и приводит к ошибкам.

**Решение:** Возможность сохранять работу как **шаблон** и загружать его в другие комнаты. При загрузке объём работ автоматически пересчитывается по метрикам нового помещения.

---

## 2. Пользовательские сценарии

### Сценарий 1: Сохранение шаблона

1. Пользователь настроил работу «Укладка ламината» в Комнате 1:
   - Цена работы: 350 ₽/м²
   - Материалы: подложка (50 ₽/м²), ламинат (1200 ₽/м²)
   - Инструменты: лобзик (аренда, 500 ₽/день)
2. В нижнем левом углу карточки работы нажимает иконку **💾 Сохранить как шаблон**
3. Работа сохраняется под тем же названием «Укладка ламината»
4. Появляется краткое уведомление: *«Шаблон сохранён»*

### Сценарий 2: Загрузка шаблона в новую комнату

1. Пользователь создал Комнату 2 (другие размеры)
2. В секции «Работы и материалы» нажимает кнопку **📋 Из шаблона**
3. Открывается модальное окно со списком сохранённых шаблонов
4. Пользователь выбирает «Укладка ламината» → нажимает **Загрузить**
5. Работа добавляется в Комнату 2 с теми же ценами и материалами
6. Объём автоматически пересчитывается: если в Комнате 2 площадь пола = 17.64 м² (вместо 10.44 м² в Комнате 1), то стоимость работы = 17.64 × 350 = 6 174 ₽
7. Модальное окно закрывается

### Сценарий 3: Обновление существующего шаблона

1. Пользователь изменил цену работы «Укладка ламината» в Комнате 3
2. Нажимает 💾 Сохранить как шаблон
3. Система обнаруживает, что шаблон с таким именем уже существует
4. Показывает подтверждение: *«Шаблон «Укладка ламината» уже существует. Заменить?»*
5. При подтверждении — шаблон обновляется

### Сценарий 4: Удаление шаблона

1. В модальном окне выбора шаблонов у каждого есть иконка 🗑️
2. При нажатии — подтверждение: *«Удалить шаблон «Укладка ламината»?»*
3. При подтверждении — шаблон удаляется

---

## 3. Модель данных

### 3.1. Тип WorkTemplate

```typescript
export type WorkTemplate = {
  id: string;                       // UUID шаблона
  name: string;                     // Название (берётся из работы)
  category: WorkTemplateCategory;   // Автоматическая категория
  unit: string;                     // Единица измерения
  workUnitPrice: number;            // Цена работы за единицу
  calculationType: CalculationType; // Способ расчёта объёма
  count?: number;                   // Количество (для customCount)
  materials: WorkTemplateMaterial[];  // Материалы (шаблонные)
  tools: WorkTemplateTool[];         // Инструменты (шаблонные)
  createdAt: string;                // ISO дата создания
  updatedAt: string;                // ISO дата последнего обновления
};

export type WorkTemplateMaterial = {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
};

export type WorkTemplateTool = {
  name: string;
  quantity: number;
  price: number;
  isRent: boolean;
  rentPeriod?: number;
};

export type WorkTemplateCategory = 'floor' | 'walls' | 'perimeter' | 'other';
```

### 3.2. Что сохраняется / не сохраняется

| Поле WorkData | Сохраняется? | Причина |
|---|---|---|
| `name` | ✅ Да | Название шаблона |
| `unit` | ✅ Да | Единица измерения |
| `workUnitPrice` | ✅ Да | Цена за единицу |
| `calculationType` | ✅ Да | Способ расчёта объёма |
| `count` | ✅ Да | Для типа `customCount` |
| `materials[]` | ✅ Да (без `id`) | Материалы шаблона |
| `tools[]` | ✅ Да (без `id`) | Инструменты шаблона |
| `id` | ❌ Нет | Генерируется при загрузке |
| `enabled` | ❌ Нет | Всегда `true` при загрузке |
| `manualQty` | ❌ Нет | Привязан к конкретной комнате |
| `useManualQty` | ❌ Нет | Привязан к конкретной комнате |
| `materialPriceType` | ❌ Нет | Legacy-поле |
| `materialPrice` | ❌ Нет | Legacy-поле |
| `isCustom` | ❌ Нет | Всегда `true` при загрузке |

### 3.3. Авто-категоризация

Категория определяется автоматически при сохранении по `calculationType`:

| `calculationType` | Категория | Отображение |
|---|---|---|
| `floorArea` | `floor` | Пол / Потолок |
| `netWallArea` | `walls` | Стены |
| `skirtingLength` | `perimeter` | Периметр |
| `customCount` | `other` | Прочее |

---

## 4. Хранение данных

### 4.1. localStorage (текущая реализация)

Новый ключ в `STORAGE_KEYS`:

```typescript
const STORAGE_KEYS = {
  PROJECTS: 'repair-calc-projects',
  ACTIVE_PROJECT: 'repair-calc-active-project',
  VERSION: 'repair-calc-version',
  LAST_BACKUP: 'repair-calc-last-backup',
  WORK_TEMPLATES: 'repair-calc-work-templates',  // ← НОВЫЙ
} as const;
```

Формат хранения: `JSON.stringify(WorkTemplate[])`.

### 4.2. MySQL (будущая реализация, см. ARCHITECTURE.md)

```sql
CREATE TABLE work_templates (
  id               VARCHAR(36) PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  category         ENUM('floor','walls','perimeter','other') DEFAULT 'other',
  unit             VARCHAR(50) DEFAULT 'м²',
  work_unit_price  DECIMAL(12,2) DEFAULT 0,
  calculation_type ENUM('floorArea','netWallArea','skirtingLength','customCount') DEFAULT 'floorArea',
  count            INT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE template_materials (
  id             VARCHAR(36) PRIMARY KEY,
  template_id    VARCHAR(36) NOT NULL,
  name           VARCHAR(255),
  quantity       DECIMAL(10,3) DEFAULT 1,
  unit           VARCHAR(50) DEFAULT 'м²',
  price_per_unit DECIMAL(12,2) DEFAULT 0,
  sort_order     INT DEFAULT 0,
  FOREIGN KEY (template_id) REFERENCES work_templates(id) ON DELETE CASCADE
);

CREATE TABLE template_tools (
  id          VARCHAR(36) PRIMARY KEY,
  template_id VARCHAR(36) NOT NULL,
  name        VARCHAR(255),
  quantity    INT DEFAULT 1,
  price       DECIMAL(12,2) DEFAULT 0,
  is_rent     BOOLEAN DEFAULT FALSE,
  rent_period INT NULL,
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (template_id) REFERENCES work_templates(id) ON DELETE CASCADE
);
```

---

## 5. Дизайн интерфейса

### 5.1. Иконка сохранения в карточке работы

**Расположение:** Нижний левый угол карточки работы, на уровне кнопки «Развернуть» (`ml-14`). Появляется при hover группы, аналогично иконкам drag handle и удаления.

```
┌───────────────────────────────────────────────────────────────┐
│ [≡] [✓] Укладка ламината                       12 600 ₽ [🗑]│
│          📦 2  🔧 1  нажмите для редактирования              │
│                                                               │
│     [💾 Сохранить как шаблон]                ▾ Развернуть    │
└───────────────────────────────────────────────────────────────┘
```

**Стиль кнопки:**
- Текст: `text-xs text-gray-500 hover:text-indigo-600`
- Иконка: `Save` из `lucide-react`, `w-3 h-3`
- Видимость: `opacity-0 group-hover:opacity-100` (как drag handle)
- Позиция: в строке с кнопкой «Развернуть», слева

**Поведение при клике:**
1. Если шаблон с таким `name` НЕ существует → сохранить, показать toast
2. Если шаблон с таким `name` СУЩЕСТВУЕТ → показать inline confirm: *«Шаблон уже есть. Заменить?»* с кнопками «Да» / «Нет»

### 5.2. Кнопка «Из шаблона»

**Расположение:** Рядом с «Добавить работу» в секции «Работы и материалы».

```
┌───────────────────────────────────────────────────────────────┐
│  [+ Добавить работу]     [📋 Из шаблона]                     │
└───────────────────────────────────────────────────────────────┘
```

Альтернативный вариант — две кнопки в одну строку:

```html
<div class="flex gap-3 mt-4">
  <button class="flex-1 ...indigo-50...">+ Добавить работу</button>
  <button class="flex-1 ...white border...">📋 Из шаблона</button>
</div>
```

**Стиль:**
- Фон: `bg-white border border-gray-200`
- Текст: `text-gray-700 hover:bg-gray-50`
- Иконка: `ClipboardList` или `BookOpen` из `lucide-react`
- Если нет сохранённых шаблонов — кнопка неактивна (`opacity-50 cursor-not-allowed`), tooltip: *«Нет сохранённых шаблонов»*

### 5.3. Модальное окно выбора шаблона

```
┌──────────────────────────────────────────────────────────────┐
│  Шаблоны работ                                          [✕] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [🔍 Поиск по названию...                               ]   │
│                                                              │
│  [Все] [Пол/Потолок] [Стены] [Периметр] [Прочее]           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Укладка ламината                         350 ₽/м²  │   │
│  │  📦 Подложка, Ламинат  🔧 Лобзик                    │   │
│  │  Расчёт: площадь пола  •  Сохранён: 01.03.2026      │   │
│  │                                                       │   │
│  │  [Загрузить]                                   [🗑️] │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Шпаклевание стен                         450 ₽/м²  │   │
│  │  📦 Шпаклёвка Knauf Fugen (25кг)                    │   │
│  │  Расчёт: площадь стен  •  Сохранён: 01.03.2026      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Монтаж плинтусов                         200 ₽/пог.м│   │
│  │  (нет материалов)                                     │   │
│  │  Расчёт: периметр  •  Сохранён: 01.03.2026           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  💡 Сохраните работу из любой комнаты, чтобы она             │
│     появилась в этом списке.                                 │
└──────────────────────────────────────────────────────────────┘
```

**Элементы модального окна:**

1. **Заголовок** + кнопка закрытия
2. **Поле поиска** — фильтрация по `name` (case-insensitive, подстрока)
3. **Фильтр по категории** — кнопки-табы: Все / Пол/Потолок / Стены / Периметр / Прочее
4. **Список шаблонов** — карточки с:
   - Название + цена за единицу
   - Иконки материалов (📦 + список через запятую) и инструментов (🔧)
   - Тип расчёта (текст) + дата сохранения
   - Кнопка **[Загрузить]** (primary action)
   - Кнопка **[🗑️]** (удалить шаблон)
5. **Empty state** — если нет шаблонов: подсказка «Сохраните работу из любой комнаты...»
6. **Пустой результат поиска** — «Шаблоны не найдены»

**Стиль модального окна:**
- Overlay: `fixed inset-0 z-50 bg-black/50` (как в BackupManager)
- Контейнер: `bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto`
- Карточки: `p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-200`

---

## 6. Логика пересчёта при загрузке

### 6.1. Что происходит при нажатии «Загрузить»

```typescript
function loadTemplate(template: WorkTemplate): WorkData {
  return {
    // Новые значения
    id: crypto.randomUUID(),
    enabled: true,
    isCustom: true,

    // Из шаблона
    name: template.name,
    unit: template.unit,
    workUnitPrice: template.workUnitPrice,
    calculationType: template.calculationType,
    count: template.count,

    // Материалы с новыми ID
    materials: template.materials.map(m => ({
      id: crypto.randomUUID(),
      name: m.name,
      quantity: m.quantity,
      unit: m.unit,
      pricePerUnit: m.pricePerUnit,
    })),

    // Инструменты с новыми ID
    tools: template.tools.map(t => ({
      id: crypto.randomUUID(),
      name: t.name,
      quantity: t.quantity,
      price: t.price,
      isRent: t.isRent,
      rentPeriod: t.rentPeriod,
    })),

    // НЕ копируются (room-specific)
    // manualQty: undefined  → авто-расчёт по метрикам комнаты
    // materialPriceType, materialPrice → legacy, не нужны
  };
}
```

### 6.2. Автоматический пересчёт объёма

Объём работы определяется `calculationType` и метриками помещения:

| `calculationType` | Формула объёма | Источник |
|---|---|---|
| `floorArea` | `room.length × room.width` (или сумма секций) | `calculateRoomMetrics().floorArea` |
| `netWallArea` | `периметр × высота - проёмы` | `calculateRoomMetrics().netWallArea` |
| `skirtingLength` | `периметр - ширина_дверей` | `calculateRoomMetrics().skirtingLength` |
| `customCount` | `template.count` (фиксированное) | Из шаблона |

**Пересчёт происходит автоматически** — `calculateRoomCosts()` уже использует метрики комнаты для расчёта объёма. При загрузке шаблона НЕ устанавливается `manualQty`, поэтому используется авто-расчёт.

### 6.3. Материалы и инструменты

Материалы и инструменты копируются **как есть** (абсолютные значения количества и цен). Пользователь может скорректировать их вручную после загрузки.

> **Примечание:** В будущей версии можно добавить возможность привязки количества материала к объёму работы (например, «расход 0.3 кг/м²»), но это за рамками текущего ТЗ.

---

## 7. Файловая структура изменений

### 7.1. Новые файлы

| Файл | Назначение |
|---|---|
| `src/types/workTemplate.ts` | Типы `WorkTemplate`, `WorkTemplateMaterial`, `WorkTemplateTool`, `WorkTemplateCategory` |
| `src/utils/templateStorage.ts` | CRUD для шаблонов в localStorage (и позже — API) |
| `src/hooks/useWorkTemplates.ts` | React-хук для управления шаблонами (load, save, delete, search) |
| `src/components/works/WorkTemplateSaveButton.tsx` | Кнопка «💾 Сохранить как шаблон» |
| `src/components/works/WorkTemplatePickerModal.tsx` | Модальное окно выбора шаблона |

### 7.2. Изменяемые файлы

| Файл | Что меняется |
|---|---|
| `src/utils/storage.ts` | Добавить `WORK_TEMPLATES` в `STORAGE_KEYS` |
| `src/components/works/WorkListItem.tsx` | Добавить кнопку сохранения (prop `onSaveAsTemplate`) |
| `src/components/works/WorkList.tsx` | Пробросить `onSaveAsTemplate` в `WorkListItem` |
| `src/components/works/index.ts` | Экспортировать новые компоненты |
| `src/App.tsx` | Добавить состояние шаблонов, кнопку «Из шаблона», обработчики |

---

## 8. API (будущая реализация)

Дополнение к REST API из [ARCHITECTURE.md](./ARCHITECTURE.md):

```
# ─── Шаблоны работ ─────────────────────────────────
GET    /api/work-templates              Список шаблонов (с поиском и фильтрацией)
POST   /api/work-templates              Создать/обновить шаблон
DELETE /api/work-templates/:id          Удалить шаблон
```

### GET /api/work-templates

**Query параметры:**
- `search` — поиск по названию (подстрока, case-insensitive)
- `category` — фильтр по категории (`floor`, `walls`, `perimeter`, `other`)

**Ответ:**
```json
{
  "templates": [
    {
      "id": "abc-123",
      "name": "Укладка ламината",
      "category": "floor",
      "unit": "м²",
      "workUnitPrice": 350,
      "calculationType": "floorArea",
      "materials": [
        { "name": "Подложка", "quantity": 1, "unit": "м²", "pricePerUnit": 50 },
        { "name": "Ламинат", "quantity": 1, "unit": "м²", "pricePerUnit": 1200 }
      ],
      "tools": [
        { "name": "Лобзик", "quantity": 1, "price": 500, "isRent": true, "rentPeriod": 3 }
      ],
      "createdAt": "2026-03-01T12:00:00Z",
      "updatedAt": "2026-03-01T12:00:00Z"
    }
  ]
}
```

---

## 9. Edge Cases и ограничения

| Ситуация | Поведение |
|---|---|
| Сохранение работы без названия | Использовать «Без названия» как имя шаблона |
| Сохранение с пустой ценой (0 ₽) | Разрешено — пользователь может заполнить позже |
| Загрузка в комнату без размеров | Работа добавляется с объёмом 0 — пользователь позже введёт размеры |
| Дубликат имени при сохранении | Подтверждение замены (см. сценарий 3) |
| Удаление шаблона не влияет на работы | Уже загруженные работы не зависят от шаблона |
| Шаблон с legacy-полями (materialPrice) | При сохранении legacy-поля игнорируются; используются только `materials[]` |
| localStorage переполнен | Показать ошибку из `StorageManager` (QuotaExceededError) |
| Большое количество шаблонов (100+) | Поиск + категории обеспечивают навигацию; виртуализация списка не нужна (внутренний инструмент) |

---

## 10. Экспорт/Импорт шаблонов

Шаблоны включаются в JSON-бэкап (`BackupManager`):

```typescript
export interface BackupData {
  version: string;
  exportedAt: string;
  projects: ProjectData[];
  activeProjectId: string;
  workTemplates?: WorkTemplate[];  // ← НОВОЕ
}
```

При импорте бэкапа шаблоны **заменяют** текущие (как и проекты).

---

## 11. Оценка трудозатрат

| Задача | Оценка |
|---|---|
| Типы и storage-слой | 2 часа |
| Hook `useWorkTemplates` | 2 часа |
| Кнопка сохранения в `WorkListItem` | 2 часа |
| Модальное окно `WorkTemplatePickerModal` | 4 часа |
| Интеграция в `App.tsx` / `RoomEditor` | 3 часа |
| Включение в экспорт/импорт (`BackupManager`) | 1 час |
| Тестирование и отладка | 2 часа |
| **Итого** | **~16 часов (2 дня)** |

---

## 12. Критерии приёмки

1. ✅ Пользователь может сохранить работу как шаблон одним кликом
2. ✅ Пользователь может загрузить шаблон в любую комнату
3. ✅ При загрузке объём автоматически пересчитывается по метрикам новой комнаты
4. ✅ Материалы и инструменты копируются с новыми ID
5. ✅ Дубликаты имён обрабатываются через подтверждение замены
6. ✅ Шаблоны сохраняются в localStorage и переживают перезагрузку
7. ✅ Шаблоны включаются в JSON-бэкап
8. ✅ Модальное окно поддерживает поиск и фильтрацию по категории
9. ✅ Пользователь может удалить ненужные шаблоны
10. ✅ UI соответствует текущему дизайну (Tailwind CSS, lucide-react иконки, indigo-палитра)

---

## 13. Мокап UI (ASCII)

### Карточка работы с кнопкой сохранения (hover state)

```
╭───────────────────────────────────────────────────────────────╮
│ ⠿ ☑ Укладка ламината                          12 600 ₽  🗑 │
│       📦 2  🔧 1  нажмите для редактирования                 │
│                                                               │
│     💾 Сохранить как шаблон                    ▾ Развернуть  │
╰───────────────────────────────────────────────────────────────╯
```

### Секция «Работы и материалы» с двумя кнопками

```
╭───────────────────────────────────────────────────────────────╮
│  Работы и материалы                                          │
│                                                               │
│  ... карточки работ ...                                       │
│                                                               │
│  ┌─────────────────────────┐  ┌────────────────────────────┐ │
│  │   ＋ Добавить работу    │  │   📋 Из шаблона            │ │
│  │   (indigo-50, primary)  │  │   (white, secondary)       │ │
│  └─────────────────────────┘  └────────────────────────────┘ │
╰───────────────────────────────────────────────────────────────╯
```
