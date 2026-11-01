FROM nginx:alpine

# Копіюємо статичні файли фронтенду у директорію Nginx за замовчуванням
COPY . /usr/share/nginx/html

# Порт контейнера для веб-сервера
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
