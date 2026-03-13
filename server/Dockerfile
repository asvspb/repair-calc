# Multi-stage build для backend

# Stage 1: Сборка
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем ВСЕ зависимости (включая devDependencies для сборки)
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

# Устанавливаем зависимости включая tsx для миграций
RUN npm ci --only=production && npm install tsx

# Копируем собранный код из builder stage
COPY --from=builder /app/dist ./dist

# Копируем исходники для миграций
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/knexfile.ts ./

# Открываем порт
EXPOSE 3994

# Запускаем сервер
CMD ["node", "dist/index.js"]