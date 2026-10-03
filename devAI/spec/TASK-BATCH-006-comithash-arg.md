# TASK-BATCH-006-comithash-arg (COMMIT_HASH в backend/migrate)

**Назначено:** coder **Подветка:** fix/comithash-arg-batch-006
**Зависит от:** TASK-BATCH-005 (ветку_base уточнит оркестратор) **Статус:** ⬜

## Цель (проверяемая)

`docker exec repair-calc-backend sh -c 'echo $COMMIT_HASH'` печатает хеш коммита сборки;
то же для migrate-контейнера. Фронтенд уже получает (Dockerfile ARG), бэкенд — нет.

## Алгоритм

1. `docker-compose.yml`: сервисам backend и migrate добавить `build.args: COMMIT_HASH: ${COMMIT_HASH:-local}` (и проверить, как фронтенд его получает — единообразно).
2. `server/Dockerfile`: `ARG COMMIT_HASH=unknown` + `ENV COMMIT_HASH=$COMMIT_HASH` в прод-стадии.
3. Проверка живьём: пересобрать backend (`docker compose up -d --build backend migrate`), `docker exec` — переменная непуста и равна текущему HEAD (`git rev-parse --short HEAD`).

## Write (ЭКСКЛЮЗИВНО)

- `docker-compose.yml`, `server/Dockerfile`
- `devAI/developer_log.md`

## Запреты

Не трогать код приложения; деплой-скрипт не менять (он уже экспортирует COMMIT_HASH).

## DoD

- [ ] docker exec показывает актуальный хеш в backend и migrate
- [ ] pnpm run lint зелёный; лог дописан

## Эскалация

Docker-окружение недоступно → архитектору.
