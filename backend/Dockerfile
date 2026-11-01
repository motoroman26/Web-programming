FROM node:20-alpine

WORKDIR /app

# Кешуємо встановлення залежностей
COPY package*.json ./
RUN npm ci --omit=dev

# Копіюємо код застосунку в образ
COPY . .

# Порт сервера
EXPOSE 8080

# Запуск бекенду
CMD ["node", "index.js"]
