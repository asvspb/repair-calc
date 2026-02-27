# Multi-stage Dockerfile для repair-calc
# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Stage 2: Production (nginx)
FROM nginx:alpine AS production

# Копируем собранные артефакты
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфиг nginx для SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
