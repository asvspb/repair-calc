# TODO: Замечания к реализации шаблонов работ

**Дата:** 2026-03-01  
**Источник:** Ревью реализации vs [WORK_TEMPLATES_SPEC.md](./WORK_TEMPLATES_SPEC.md)

---

## 🚀 Новая фича: Авто-пересчёт материалов (v2)

> Подробный дизайн: [WORK_TEMPLATES_SPEC.md, раздел 6.4](./WORK_TEMPLATES_SPEC.md)

При загрузке шаблона в другую комнату материалы должны пересчитываться пропорционально объёму.

**Пример:** «Волма ровнитель» 45 шт при площади 10.44 м² → 76 шт при площади 17.64 м².

### Задачи реализации

- [ ] **Добавить `sourceVolume?: number` в тип `WorkTemplate`** — `src/types/workTemplate.ts`. Объём работы при сохранении (м², пог.м, шт). Опциональное для обратной совместимости.

- [ ] **Обновить `saveTemplate` — передавать `workVolume`** — `src/hooks/useWorkTemplates.ts`: добавить третий аргумент `workVolume: number`, сохранять как `sourceVolume` в шаблон.

- [ ] **Обновить `loadTemplate` — масштабировать материалы** — `src/hooks/useWorkTemplates.ts`: добавить второй аргумент `targetMetrics: RoomMetrics`, вычислять `ratio = targetVolume / sourceVolume`, умножать `material.quantity × ratio`. Инструменты НЕ масштабировать.

- [ ] **Обновить `handleSaveTemplate` в `RoomEditor`** — `src/App.tsx`: вычислять `workVolume` из `metrics` по `calculationType`, передавать в `onSaveTemplate(work, force, workVolume)`.

- [ ] **Обновить `handleLoadTemplate` в `RoomEditor`** — `src/App.tsx`: передавать `metrics` в `onLoadTemplate(template, metrics)`.

- [ ] **Обновить типы пропсов `RoomEditor`** — `src/App.tsx`: заменить `any` на `WorkTemplate`, `SaveResult`.

- [ ] **Обновить SQL-схему для будущего MySQL** — `docs/WORK_TEMPLATES_SPEC.md`: добавить `source_volume DECIMAL(10,3)` в таблицу `work_templates`.

---

## ⚠️ Баги / Расхождения с ТЗ (v1)

- [ ] **`CATEGORY_LABELS` в модальном окне расходится с типом** — `src/components/works/WorkTemplatePickerModal.tsx` строка 15–20: локальный объект содержит `ceiling: 'Потолок'` (которого нет в типе `WorkTemplateCategory`) и **не содержит** `perimeter: 'Периметр'`. В результате фильтр «Потолок» никогда ничего не покажет, а шаблоны с `calculationType: 'skirtingLength'` не видны по категории. **Исправление:** импортировать `CATEGORY_LABELS` из `src/types/workTemplate.ts` и добавить ключ `all: 'Все'`.

- [ ] **Скрытые `any` в пропсах `RoomEditor`** — `src/App.tsx`, компонент `RoomEditor`: пропсы `templates: any[]`, `onSaveTemplate: (...) => any`, `onLoadTemplate: (template: any) => WorkData`. Теряется типобезопасность. **Исправление:** заменить на `WorkTemplate[]`, `SaveResult` и `(template: WorkTemplate) => WorkData`. *(будет исправлено вместе с v2)*

- [x] **Статус ТЗ устарел** — `docs/WORK_TEMPLATES_SPEC.md` указывал «Статус: Проектирование». **Исправлено:** обновлён на «Реализовано (v1)».

---

## 💡 Улучшения UX

- [ ] **`index.ts` бочка не обновлена** — `src/components/works/index.ts` экспортирует только `WorkList` и `WorkListItem`, но не `WorkTemplateSaveButton` и `WorkTemplatePickerModal`.

- [ ] **Нативный `confirm()` при удалении шаблона** — `WorkTemplatePickerModal.tsx` использует `confirm('Удалить этот шаблон?')`. Для внутреннего инструмента допустимо, но лучше заменить на inline-подтверждение (как уже сделано в `WorkTemplateSaveButton` для замены).

- [ ] **Нет анимации появления/закрытия модалки** — `WorkTemplatePickerModal` появляется/исчезает мгновенно. Добавить CSS transition для overlay и контейнера.

- [ ] **Нет обработки Escape для закрытия модалки** — модальное окно не обрабатывает нажатие клавиши Escape.

- [ ] **Нет клика по overlay для закрытия модалки** — клик по затемнённому фону не закрывает окно.
