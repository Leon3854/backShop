FROM node:20-alpine

WORKDIR /app

# Копируем всё (уже с установленными зависимостями)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]