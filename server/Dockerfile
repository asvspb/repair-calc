# syntax=docker/dockerfile:1
# Multi-stage build для backend

# Stage 1: Сборка
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm (версия пиннится полем packageManager в package.json)
RUN corepack enable

# Копируем lock-файлы pnpm
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

# Устанавливаем build dependencies для native modules (например, better-sqlite3)
RUN apk add --no-cache python3 make g++

# Устанавливаем ВСЕ зависимости (включая devDependencies для сборки).
# Builder-stage делает только tsc — браузеры playwright здесь не нужны,
# пропускаем их загрузку (~150 МБ). Prod-stage ниже браузеры ставит (runtime).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN pnpm run build

# Stage 2: Продакшн образ
FROM node:20-alpine

ARG COMMIT_HASH=unknown
ENV COMMIT_HASH=${COMMIT_HASH}

WORKDIR /app

# pnpm (версия пиннится полем packageManager в package.json)
RUN corepack enable

# Копируем lock-файлы pnpm
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

# Устанавливаем зависимости включая tsx для миграций, и необходимые инструменты для сборки
RUN apk add --no-cache python3 make g++

# Кэшируем браузеры playwright (postinstall playwright качает их в /root/.cache/ms-playwright,
# ~150 МБ на каждую сборку без кэша). BuildKit cache-mount переживает `docker compose build`,
# поэтому вторая сборка пропускает загрузку браузеров.
RUN --mount=type=cache,target=/root/.cache/ms-playwright \
    pnpm install --frozen-lockfile --prod \
    && pnpm add tsx \
    && apk del python3 make g++

# Копируем собранный код из builder stage
COPY --from=builder /app/dist ./dist

# Копируем исходники для миграций (все .ts файлы)
COPY src/db/migrations ./src/db/migrations
COPY --from=builder /app/knexfile.ts ./

# Открываем порт
EXPOSE 3994

# Запускаем сервер
CMD ["node", "dist/index.js"]
