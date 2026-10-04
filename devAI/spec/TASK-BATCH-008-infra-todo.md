# TASK-BATCH-008-infra-todo

**Назначено:** coder **Подветка:** fix/infra-008 **База:** fix/audit-007 **Статус:** ⬜

## Цель

(1) Кэш Playwright-браузеров в Docker-сборке сервера (P1-2). (2) Актуализация docs/TODO.md под факт (закрыть выполненное, почистить устаревшее).

## Часть 1 — Docker-кэш

`server/Dockerfile`: установка playwright-браузеров через `RUN --mount=type=cache,target=/root/.cache/ms-playwright` (проверь фактический путь кэша в образе; сейчас prod-стадия ставит браузеры — найди где). Проверка: `docker compose build backend` дважды — вторая сборка существенно быстрее на шаге браузеров (зафиксируй времена в логе).

## Часть 2 — TODO.md

Закрыть [x]: P1-1 (деплой сделан 2026-10-03, живая проверка), P2-2 (batch-004), P2-5 (batch-003), P3-1 устаревшие строки (RoomEditor уже 277 строк — распилен; roomHelpers.ts не существует). Обновить P1-3 под фактический audit-результат batch-007. Добавить P2-пункт: остаточные mysql2-комментарии в server/src/db/pool.ts → закрыть сразу же (файл в write-set ниже).

## Write (ЭКСКЛЮЗИВНО)

server/Dockerfile, server/src/db/pool.ts (только комментарии), docs/TODO.md, devAI/developer_log.md.

## DoD

- [ ] Вторая docker-сборка быстрее на шаге браузеров (время в логе); gates зелёные; TODO соответствует факту.
