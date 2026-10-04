# SPEC-SYNC-V2 — dirty-flag + Last-Writer-Wins

**Версия:** 1.0 (Draft)
**Дата создания:** 2026-10-04
**Статус:** Draft — идёт владельцу на утверждение **ДО** имплементации (ROADMAP R2:
«Спека (утверждается архитектором ДО кода)» — `devAI/spec/ROADMAP-fsd.md:29-30`)
**Автор:** analyst (AI)
**Base:** `refactor/fsd-r1-017` @ `f4e11e8` (подветка `docs/sync-v2-spec-018`)
**ТЗ:** `devAI/spec/TASK-BATCH-016-018.md`, секция TASK-BATCH-018-sync-v2-spec
**Связанные документы:** `docs/IDEAL-ARCHITECTURE.md` §4 (Offline-first), `docs/ARCHITECTURE.md` §6,
`devAI/spec/ROADMAP-fsd.md` (R2, batch'и а-г)

**Все ссылки на строки сверены с деревом на коммите-базе в этой сессии.** Спека не содержит
код-изменений; «модель» ниже — дизайн-решения, а не существующий код.

---

## Содержание

1. [Текущий sync — факты из кода](#1-текущий-sync--факты-из-кода)
2. [Модель SYNC-V2: dirty-флаги, очередь, flush](#2-модель-sync-v2-dirty-флаги-очередь-flush)
3. [LWW: поле сравнения, tie-break, конфликты, гость](#3-lww-поле-сравнения-tie-break-конфликты-гость)
4. [Миграция с текущего pull-всего и откат](#4-миграция-с-текущего-pull-всего-и-откат)
5. [Разрез на 4 batch'а имплементации (а-г)](#5-разрез-на-4-batchа-имплементации-а-г)
6. [Риски и открытые вопросы владельцу](#6-риски-и-открытые-вопросы-владельцу)
7. [DoD спеки](#7-dod-спеки)

---

## 1. Текущий sync — факты из кода

### 1.1 Выбор провайдера хранения

- `getStorageProvider()` возвращает `ApiStorageProvider`, если в localStorage есть токен,
  иначе `IndexedDbProvider` — `src/api/storage/apiStorageProvider.ts:340-346`.
  Граница «гостя» = наличие `STORAGE_KEYS.TOKEN` (`shared/utils/storageConstants.ts:12`).
- Гость: `IndexedDbProvider` (Dexie `RepairCalcDB`) — таблицы `projects`, `workTemplates`,
  `keyValueStore`; сохранение проектов — `clear()` + `bulkPut` в транзакции
  (`src/api/storage/dexieDb.ts:18-22`, `src/api/storage/indexedDbProvider.ts:71-101`).
- Перенос localStorage → IndexedDB — одноразовый, с флагом `dexie_migrated` и бэкапами:
  `src/api/storage/indexedDbMigration.ts:10-29, 99-106`.

### 1.2 Pull — всегда «всё целиком»

- Инициализация при авторизации: `initializeProjects` → `apiProvider.loadProjectsAsync()`
  (`src/store/projectInitialize.ts:55`).
- `loadProjectsAsync` → `projectsApi.syncPull()` → `GET /api/sync/pull`
  (`src/api/storage/objectApi.ts:111-139`; `src/api/projects.ts:302-316`).
- Сервер: `GET /api/sync/pull` возвращает **все** проекты пользователя с объектами и
  комнатами — `ProjectRepository.findAllByUserIdWithObjects` без параметра `since`
  (`server/src/routes/sync.ts:183-222`). Инкрементального pull **нет**.
- При ошибке pull — fallback на localStorage-копию (`src/api/storage/objectApi.ts:127-138`).

### 1.3 Push — через CRUD-эндпоинты, не через /api/sync/push

- Автосейв: `scheduleSave` с debounce 2000 мс (`src/store/createSyncSlice.ts:16, 47-141`).
  Мутации входят через `updateProjects`/`updateActiveProject`
  (`src/store/createProjectSlice.ts:67, 88`).
- Дифф внутри `scheduleSave` сравнивает `get().projects` **с самим собой**: снимок
  `currentProjects` берётся в момент срабатывания таймера (`createSyncSlice.ts:57`), а не на
  момент вызова `scheduleSave`; снапшот `pendingSave` (строка 48) в сравнении не участвует.
  Следствие: в обычном прогоне `changedProjects` пуст и выполняется ветка **полного**
  сохранения списка; ветка «инкрементально один проект» (строки 69-100) достижима только
  при мутации стора между строками 57 и 62 — практически мёртвый путь.
- Полный путь: `saveAllProjects` (`src/api/storage/projectApi.ts:29-230`) — тянет существующие
  проекты с сервера (строка 50), затем по каждому решает update / миграцию локального
  (создание + `idMapper.addMapping`, строки 111, 163, 292) / «серверный ID, но нет на сервере —
  создаём заново» (строки 148-183).
- Инкрементальный путь (по факту не срабатывает, см. выше): `saveProjectIncremental`
  (`src/api/storage/projectApi.ts:236-324`).
- Обновление проекта: `updateProjectAsync` выбирает транзакционный `PUT /:id/with-objects`
  либо `PUT /:id/with-rooms` либо `PUT /:id` (`src/api/storage/objectApi.ts:167-203`;
  эндпоинты: `server/src/routes/projects.ts:238, 369, 423`).
- **version сознательно не отправляется** — «сервер сам инкрементирует… предотвращает 403
  Version conflict» (`src/api/storage/objectApi.ts:58-59`); сервер при `data.version !==
existing.version` отвечает 403 (`server/src/routes/projects.ts:251-255`) и ставит
  `version = existing.version + 1` (строка 265).
- Комнаты синхронизируются последовательно внутри проекта с rate-limit; ошибки копятся в
  `RoomSyncErrors` (ключ `projectId:roomId`) — `src/api/storage/roomApi.ts:14-37, 43-61`;
  UI опрашивает ошибки раз в 5 с (`createSyncSlice.ts:213-231`).
- Удаление: `markProjectDeleted` **до** DELETE, чтобы очередь выкинула pending-запросы
  проекта (`src/api/storage/objectApi.ts:209-225`; `src/api/storage/apiClient.ts:104-107`;
  вызов из слайса — `src/store/createProjectSlice.ts:202-208`).
- Расчётные итоги идут отдельным контуром `scheduleTotalsSave` (только авторизованным, только
  серверные ID, debounce 2000) — `src/store/createSyncSlice.ts:143-188`.

### 1.4 Очередь и rate-limit

- Клиентская очередь `RequestQueue`: min-интервал 500 мс между запросами, до 3 ретраев
  (`src/api/storage/apiStorageProvider.ts:20-21`), обработка по одному запросу
  (`src/api/storage/apiClient.ts:119-178`), backoff на 429 — `min(1000·2^n, 10000)` мс
  (`apiClient.ts:154-164`), пропуск запросов удалённых проектов (`apiClient.ts:130-137`).
- **Серверный rate-limiter отключён полностью** — все лимитеры возвращают «разрешено»
  (`server/src/middleware/rateLimiter.ts:1-10`). Защита от 429 — только клиентская.
- HTTP-слой: таймаут 30 с с `AbortController` (`src/api/httpClient.ts:10, 214-215`),
  401 → refresh токена и один повтор (`httpClient.ts:264-275`), AbortError → 408
  (`httpClient.ts:290-293`).
- Поверх очереди — `saveQueue` (singleton): хранит одну pending-задачу (новая заменяет
  старую), персистит данные в `localStorage[repair-calc-pending-save]` с TTL 1 час
  (`src/utils/saveQueue.ts:19-62, 101-111`); восстановление и beforeunload /
  visibilitychange-триггеры — `createSyncSlice.ts:190-245`.
- Кэш проектов провайдера: `Map` + TTL 30 с (`apiStorageProvider.ts:22, 30-31, 107-109`).

### 1.5 Конфликты: что есть сейчас

- Серверный `POST /api/sync/push` **существует** с LWW-подобной проверкой версий
  (`clientVersion < serverVersion` → конфликт, `server/src/routes/sync.ts:53-133`) и схемой
  `syncPushSchema` (`server/src/middleware/validation.ts:253-262`), но **клиент его не
  вызывает ни разу** (grep `syncPush|/sync/push` по `src/` — 0 вхождений, проверено в этой
  сессии). Клиент конфликтует через 403-версионную защиту PUT (§1.3) и «сервер всегда прав»
  при pull.
- В `syncPushSchema` entity — `project|room|work|material|tool|opening|subsection|segment|
obstacle|wall_section`: **entity `object` отсутствует**; `id` и `entityId` обязаны быть
  UUID, тогда как клиентские локальные ID имеют префикс `local-`
  (`shared/utils/idMapper.ts:235, 249`).
- Ключевой пробел для LWW: серверные `updated_at` есть у проекта/объекта/комнаты
  (`src/api/projects.ts:27, 39-40, 76-77`; сервер обновляет `updated_at` при записи —
  `server/src/db/repositories/room.repo.ts:179`, `object.repo.ts:112`), но
  `apiToClientProject`/`apiToClientRoom` **не переносят их в клиентскую модель** — в
  `ProjectData`/`ObjectData`/`RoomData` поля `updatedAt` нет (`shared/types.ts:126-170`).
  Отсюда: LWW «по updated_at» на клиенте сегодня физически невозможен.
- Любопытный артефакт: Dexie-индекс `projects: 'id, updatedAt'` (`dexieDb.ts:19`) ссылается
  на поле, которого в клиентской модели нет, — индекс мёртвый.
- Гранулярность сущностей: работы/материалы/проёмы — JSON-поля комнаты
  (`RoomData.works[]` — `shared/types.ts:139`; сервер хранит `works` как строку —
  `src/api/projects.ts:72`), собственных строк в БД у них нет → dirty-гранулярность
  ограничена project / object / room.

### 1.6 Вывод из фактов (мотивация V2)

1. Каждое изменение любого поля любой комнаты = полный `PUT` проекта со всеми объектами и
   комнатами + дифф фактически не работает (§1.3) → O(размер всех данных) трафика каждые 2 с
   активности.
2. Pull всегда полный (§1.2) — при старте и после каждой полной синхронизации.
3. Конфликты разрешаются молча в пользу сервера; клиентской метки времени нет (§1.5) —
   «last writer» определить нечем.
4. `request /api/sync/push` с готовой LWW-логикой простаивает (§1.5).

---

## 2. Модель SYNC-V2: dirty-флаги, очередь, flush

### 2.1 Dirty-флаги на сущность

- Сущности: **project, object, room** (граница — §1.5.6: works/matериалы — часть room).
- Флаги живут **в sync-домене, не в доменных слайсах** (принцип IDEAL §4: «состояние sync…
  не пачкает доменные слайсы», `docs/IDEAL-ARCHITECTURE.md:186-187`). В `SyncSlice`
  (`src/store/types.ts:61-74`) появляется карта:

  ```
  dirty: Record<entityKind, Record<entityId, { updatedAt: string(ISO); op: 'upsert' }>>
  dirtyCount: number
  lastSyncAt: Date | null
  status: 'idle' | 'flushing' | 'error'
  ```

  Слайсы-мутаторы (`updateProjects`, `updateActiveProject`, room/object-экшены) вместо
  прямого `scheduleSave` вызывают `markDirty(entityKind, entityId, updatedAt)`.

- `updatedAt` на сущности: поле добавляется в `ProjectData`/`ObjectData`/`RoomData`
  (`shared/types.ts`) как ISO-строка; ставится при локальной мутации, перезаписывается
  серверным `updated_at` при pull (§3.1). Серверные поля маппятся в `apiToClient*`
  (`src/api/projects.ts:83-142`).
- **Persist-формат:** флаги и `updatedAt` переживают перезагрузку — хранятся в Dexie:
  - `updatedAt` — на самой записи (таблица `projects` уже индексирует `updatedAt` —
    `dexieDb.ts:19`; после добавления поля индекс перестанет быть мёртвым);
  - карта dirty — новая таблица `syncState` (схема Dexie **version 2**) либо запись в
    `keyValueStore`. Выбор — за batch'ем (а), см. §5.
- **Граница «гостя»:** гость по-прежнему пишет только в IndexedDB (`§1.1`); dirty-флаги у
  гостя тоже пишутся (единая модель), но флашер для гостя **не запускается** (нет токена —
  нет очереди и сетевых вызовов). При логине флаги гостя потребляет существующий
  миграционный путь `saveAllProjects` (§1.3) — либо, после утверждения, новый флашер;
  решение — открытый вопрос №5 (§6).
- Комнаты гостя в `keyValueStore`-структурах — не трогаем: карта dirty для гостя
  восстанавливается из `updatedAt`-полей записей при старте (фильтр «`updatedAt` > последнего
  подтверждённого sync»), отдельный персист необязателен. Точное решение фиксируется в ТЗ
  batch'а (а).

### 2.2 Исходящая очередь (flusher)

- Один флашер на приложение (модуль в `src/api/storage/` рядом с `apiClient.ts`), который
  переиспользует `RequestQueue` (rate-limit 500 мс, ретраи 429, backoff — §1.4) как
  транспортный слой. `saveQueue`/`PENDING_SAVE` (§1.4) заменяются dirty-картой: персистентность
  обеспечивает Dexie, а не localStorage.
- **Дедуп:** в карте dirty на сущность хранится одно последнее состояние — повторные мутации
  до флаша затирают предыдущий элемент (текущая семантика saveQueue «только последнее
  состояние» — `saveQueue.ts:98-111` — сохраняется, но на уровне сущности, а не всего
  списка).
- **Порядок:** в рамках одной сущности — последний выигрывает (дедуп это гарантирует);
  между сущностями — parent-before-child: project → его objects → их rooms (создание комнаты
  требует существования объекта на сервере — см. обработку «нет project_id» на сервере,
  `server/src/routes/sync.ts:99-102`).
- **Батчинг:** за один flush — пачка до N=50 изменений на `POST /api/sync/push`
  (контракт — §3.4); при переполнении очередь не очищается до подтверждения пачки.
- **Ошибки:** сеть/429 — элемент остаётся dirty (ретрай транспортом); 403/404/валидация —
  элемент снимается с очереди, фиксируется в `status`+логе (см. §3.3).

### 2.3 Flush-триггеры

1. **Online:** `window.addEventListener('online')` — немедленный flush.
2. **Интервал:** таймер 30 с при наличии dirty (значение — константа модуля, не env).
3. **Действие:** debounce 2 с после мутации (наследует текущий UX
   `SAVE_DEBOUNCE_MS=2000`, `createSyncSlice.ts:16`) — чтобы ввод не порождал запросы.
4. **beforeunload / visibilitychange→hidden:** попытка синхронного сброса в Dexie (уже
   реализовано для pendingSave — `createSyncSlice.ts:193-208` — переносится на dirty-модель).

---

## 3. LWW: поле сравнения, tie-break, конфликты, гость

### 3.1 Поле сравнения

- **Авторитет — серверное `updated_at`** (UTC, ставит БД: `room.repo.ts:179`,
  `object.repo.ts:112`; проект — аналогично в `ProjectRepository.update`). Клиент хранит
  зеркальное `updatedAt` (ISO) и **отправляет его в push только как `clientUpdatedAt`**
  (информационно/tie-break), а не как истину.
- **Merge при pull:** для каждой сущности сервера сравнивается `server.updatedAt` и
  локальная dirty-запись:
  - локальная не dirty → принять серверную версию безусловно (сегодняшнее поведение);
  - локальная dirty и `local.updatedAt > server.updatedAt` → локальная новее: оставить
    локальную, не снимать dirty (она уйдёт пушем);
  - локальная dirty и `local.updatedAt <= server.updatedAt` → сервер новее: **LWW — сервер
    затирает локальную**, dirty снимается, факт затирания логируется (`logWarning`,
    категория Sync) и увеличивает счётчик `conflictsResolved` в sync-состоянии. Молчаливая
    потеря правок локального пользователя при этом честно видна в UI (бейдж), если владелец
    закажет — вне минимального скоупа.

### 3.2 Tie-break

При равенстве `updatedAt` (секундное разрешение БД): побеждает запись с **бóльшим
лексикографически `id`**. Правило выбрано детерминированным и одинаковым на клиенте и
сервере; альтернатива «device-id в tie-break» — открытый вопрос №2 (§6).

### 3.3 409 / удалённая на сервере сущность / гарантии гостя

- **409-конфликт на push:** контракт push (§3.4) возвращает по-сущностный результат
  `accepted | conflict { serverUpdatedAt, serverEntity }`. Клиентская обработка: если
  `serverUpdatedAt >= clientUpdatedAt` — принять серверную (заменить локальную, снять
  dirty); иначе — повторный push этой сущности в следующем flush. Сегодняшних 409 в
  sync-контуре нет (версионный конфликт PUT — 403, `projects.ts:254`); 403 на push
  трактуется как conflict.
- **Сущность удалена на сервере (отсутствует в pull):**
  - локальная не dirty → удалить локально (согласие с сервером);
  - локальная dirty → пересоздать пушем (сохранение данных важнее «удаления с другого
    устройства» — это продолжает текущее поведение «серверный ID, но нет на сервере —
    создаём заново», `projectApi.ts:148-183`).
    Межустройственная семантика удаления требует tombstone'ов — открытый вопрос №4 (§6).
- **Гарантии для гостя:** модель не меняет гостевой путь: тот же провайдер
  (`getStorageProvider`, §1.1), те же таблицы Dexie, ноль сетевых вызовов без токена;
  флашер активируется только при `isAuthenticated` (источник — `AuthSlice`,
  `src/store/types.ts:37-40`). Отключение сети/ошибки сервера никогда не блокируют UI:
  запись → Dexie немедленно, сервер — асинхронно (наследование optimistic-принципа
  `docs/ARCHITECTURE.md:632-636`).

### 3.4 Контракт push (минимальные серверные правки)

Существующий `POST /api/sync/push` дорабатывается (не заменяется):

- `syncPushSchema` (`server/src/middleware/validation.ts:253-262`): добавить entity
  **`object`**; `id`/`entityId` — разрешить также `local-*` ID (для upsert-новых); в
  `data` — необязательное `clientUpdatedAt`.
- Серверная проверка: сравнение `data.clientUpdatedAt` против `updated_at` строки вместо
  текущего сравнения `version` (`sync.ts:72, 123`), LWW + tie-break §3.2; ответ —
  `{ synced: string[], conflicts: Conflict[] }` (форма ответа сохраняется,
  `sync.ts:169-175`).

---

## 4. Миграция с текущего pull-всего и откат

- **Feature-flag:** `VITE_SYNC_V2` (env, читается через `import.meta.env` — прецедент
  `VITE_E2E_TEST_MODE`, `src/App.tsx:286`). Значение фиксируется при сборке; `true` →
  sync-домен V2, отсутствует/`false` → текущий путь нетронут (оба живут параллельно до R5).
  Флаг не персистится в localStorage — только env (один источник истины на окружение).
- **Первый запуск под флагом:**
  1. полный pull (как сегодня, §1.2) → заполнение `updatedAt` на всех сущностях из
     серверных `updated_at` (маппинг добавить в `apiToClient*`);
  2. dirty-карта пуста; локальные сущности без маппинга обрабатываются существующей
     миграцией `saveAllProjects` (idMapper, §1.3);
  3. далее — инкрементальный pull: `GET /api/sync/pull?since=<lastSyncAt ISO>`; сервер при
     `since` фильтрует по `updated_at >= since` (правка `server/src/routes/sync.ts:183-222`,
     только чтение). `lastSyncAt` персистится в Dexie (`syncState`).
- **Обратная совместимость данных:** схема клиентской модели меняется аддитивно
  (`updatedAt` — опциональное поле), старые localStorage/IndexedDB-снимки валидны;
  Dexie `version(2)` добавляет `syncState` (см. §2.1) — добавление таблицы не требует
  переноса данных.
- **Откат-план:**
  1. снять `VITE_SYNC_V2` (env/docker-compose) → пересобрать frontend — код V2 мёртв,
     legacy-путь работает на прежних эндпоинтах;
  2. данные: V2 пишет в те же таблицы Dexie и те же серверные строки (через те же CRUD),
     откат не теряет данные; карта `syncState` просто перестаёт читаться;
  3. серверные правки (schema push + `since` на pull) аддитивны и безопасны при выключенном
     клиентском флаге — откат сервера отдельно не требуется;
  4. если откат случился с несброшенными dirty — после повторного включения V2 dirty-карта
     восстанавливается из `syncState`/`updatedAt` (§2.1) и досылается.

---

## 5. Разрез на 4 batch'а имплементации (а-г)

Разрез — из ROADMAP R2 (`devAI/spec/ROADMAP-fsd.md:35-37`); порядок строго а → б → в → г.
После каждого batch'а — gates (`pnpm test`, `pnpm run lint`, `pnpm run lint:deps`) зелёные и
атомарные коммиты.

### (а) dirty-флаги в слайсах + persist

- **Write-set (эксклюзивно):** `shared/types.ts` (опциональные `updatedAt` на трёх
  сущностях), `src/api/storage/dexieDb.ts` (version(2), таблица `syncState`), маппинг
  `updated_at` в `src/api/projects.ts` (`apiToClient*`), `src/store/createSyncSlice.ts` +
  `src/store/types.ts` (карта dirty, `markDirty`), мутаторы-вызовы
  (`createProjectSlice.ts`, `createRoomSlice.ts`, `createObjectSlice.ts`), тесты
  `tests/`.
- **Не трогать:** сетевой слой, сервер.
- **DoD:** любая мутация project/object/room ставит dirty+updatedAt; карта и `updatedAt`
  переживают reload (тест на восстановление из Dexie); гость не инициирует сетевых
  вызовов; включение пока ни на что не влияет (флаг ещё не читается) — gates зелёные.

### (б) Исходящая очередь / флашер

- **Write-set:** новый модуль флашера в `src/api/storage/` (рядом с `apiClient.ts`,
  переиспользует `RequestQueue`), `src/store/createSyncSlice.ts` (триггеры §2.3),
  контракты клиента `src/api/`, тесты (в т.ч. оффлайн-сценарий: dirty копится,
  `online` → flush).
- **DoD:** flush по online/интервалу/действию; дедуп по сущности; порядок
  parent-before-child; rate-limit/backoff унаследованы (тест на очередь ≥ N изменений);
  ошибки сети оставляют dirty, ошибки валидации снимают с логом; под флагом по умолчанию
  не активен.

### (в) LWW-слияние на pull (+минимальные серверные правки)

- **Write-set:** `server/src/routes/sync.ts` (`?since=` на pull; LWW-сравнение на push),
  `server/src/middleware/validation.ts` (schema push: entity `object`, `local-*` ID,
  `clientUpdatedAt`), клиентский merge в `src/api/storage/` (pull-merge §3.1, обработка
  409/удалённых §3.3), `src/api/projects.ts`, тесты клиента и `server/tests/`.
- **DoD:** матрица конфликтов покрыта unit-тестами: сервер новее / клиент новее / tie /
  удалено на сервере (dirty и не dirty) / 409; инкрементальный pull не возвращает
  неизменённые проекты (тест сервера); параллельно сервер остаётся совместим со старым
  клиентом (без `since` — полный pull как сегодня).

### (г) Переключение фронтенда на новый sync под флагом

- **Write-set:** `src/store/projectInitialize.ts` (развилка по флагу), фабрика провайдера
  `src/api/storage/index.ts`, env-примеры (`.env.example`, `docker-compose.yml` — по
  фактическому списку env-файлов в репо), e2e (`e2e/`), `INDEX.md`,
  `docs/ARCHITECTURE.md` §6, `devAI/developer_log.md`.
- **DoD:** `VITE_SYNC_V2=true` — весь жизненный цикл (init pull → мутации → flush →
  конфликт) идёт через V2; без флага — побайтово прежнее поведение (сравнение e2e в обоих
  режимах); откат-план §4 задокументирован и проверен переключением флага; лог/INDEX
  обновлены.

**Параллелизм:** (а)-(в) строго последовательно; (в) и R3 (декомпозиция `update.ts`) —
не пересекаются по write-set, как оговорено в ROADMAP (`ROADMAP-fsd.md:59-61`); (г) — после
стабильного (в) + утверждения владельцем результатов e2e.

---

## 6. Риски и открытые вопросы владельцу

1. **Часы клиента ≠ истина.** LWW сравнивает `updated_at`, но клиентская dirty-метка
   ставится часами устройства; рассинхрон устройств искажает «кто последний». Митинг в
   спеке: авторитет — серверное `updated_at`, клиентская метка — только tie-break.
   Решить: достаточно ли этого, или нужен серверный `server_received_at`-журнал.
2. **Tie-break по `id`** (§3.2) детерминирован, но произволен; альтернатива — device-id
   (порядок «позже подключившееся устройство выигрывает»). Выбрать одно и закрепить и на
   клиенте, и в `sync.ts`.
3. **`syncPushSchema` не знает entity `object` и требует UUID** (`validation.ts:254-261`
   против локальных `local-*` ID — `idMapper.ts:249`): контракт push придётся расширять.
   Решить: дорабатывать существующий `/api/sync/push` (предложено §3.4) или ввести
   `/api/sync/v2/push`.
4. **Удаления не распространяются между устройствами** (нет tombstone/soft-delete на
   сервере; §3.3). Принять текущую семантику «dirty локальная пересоздаёт» или заказать
   tombstones (отдельный batch).
5. **Гость → логин:** переиспользовать существующий миграционный путь `saveAllProjects`
   (§1.3) для dirty-сущностей гостя или прогонять их через новый флашер? Второе чище,
   но расширяет (б).
6. **`scheduleTotalsSave` и `saveQueue`/`PENDING_SAVE`** — контуры вне dirty-модели
   (§1.3, §1.4). Включить итоги во flusher или оставить отдельным контуром (предложено:
   оставить)?
7. **Мёртвый Dexie-индекс `updatedAt`** (`dexieDb.ts:19`): в (а) он «оживёт»; убедиться,
   что schema-версия не ломает существующих пользователей (добавление таблицы — ок,
   изменение индексов существующих — потребует переноса).
8. **Мульти-вкладка:** два экземпляра флашера = гонка `lastSyncAt` и дубли push.
   Минимум: принять «возможны дубли-push, идемпотентные по entity+updatedAt»; максимум —
   лидерство через `BroadcastChannel`. Решить на этапе (б).
9. **Объём полного pull** при большом числе проектов (§1.2) до внедрения `since` — (г)
   не включать без (в).

---

## 7. DoD спеки

- [x] Спека самодостаточна: модель описана без чтения кода, все факты §1 снабжены
      `файл:строка`, сверенными в этой сессии на базе `f4e11e8`.
- [x] Все 6 обязательных разделов ТЗ (TASK-BATCH-018, «Обязательные разделы спеки»)
      присутствуют: §1 текущий sync; §2 модель (флаги/очередь/триггеры); §3 LWW; §4
      миграция+флаг+откат; §5 четыре batch'а а-г с write-set и DoD; §6 риски/вопросы.
- [x] Ни одной строки кода не изменено: write-set этой задачи — только
      `devAI/spec/SPEC-SYNC-V2.md` и `devAI/developer_log.md`.
- [ ] Утверждение владельцем → снятие статуса Draft → нарезка ТЗ batch'ев (а)-(г)
      (вне скоупа этой задачи).
- [ ] Gates зелёные на итоговом дереве (проверяется этой же задачей; результат — в логе).
