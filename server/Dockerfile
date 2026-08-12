# Multi-stage build для backend

# Stage 1: Сборка
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем build dependencies для native modules (например, better-sqlite3)
RUN apk add --no-cache python3 make g++

# Устанавливаем ВСЕ зависимости (включая devDependencies для сборки).
# Builder-stage делает только tsc — браузеры playwright здесь не нужны,
# пропускаем их загрузку (~150 МБ). Prod-stage ниже браузеры ставит (runtime).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Stage 2: Продакшн образ
FROM node:20-alpine

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости включая tsx для миграций, и необходимые инструменты для сборки
RUN apk add --no-cache python3 make g++ \
    && npm ci --omit=dev \
    && npm install tsx \
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