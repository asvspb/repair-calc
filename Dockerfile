FROM nginx:alpine

# Копируем конфиг nginx
COPY .docker/nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранное приложение
COPY dist /usr/share/nginx/html

# Открываем порт
EXPOSE 3980

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]
