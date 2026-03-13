# Multi-stage build для клиента

# Stage 1: Сборка приложения
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем все зависимости (включая devDependencies для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Stage 2: Продакшн образ с nginx
FROM nginx:alpine

# Копируем конфиг nginx
COPY .docker/nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Открываем порт
EXPOSE 3980

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]